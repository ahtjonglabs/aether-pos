import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { safeJson, safeJsonError } from '@/lib/safe-response'

interface HourBucket {
  hour: number
  transactionCount: number
  revenue: number
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return unauthorized()
    }
    const outletId = user.outletId
    const isOwner = user.role === 'OWNER'

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterdayStart = new Date(todayStart.getTime() - 86_400_000)

    // ── All-time totals ──
    const [revenueResult, totalTxCount, totalProducts] = await Promise.all([
      db.transaction.aggregate({
        where: { outletId },
        _sum: { total: true },
      }),
      db.transaction.count({ where: { outletId } }),
      db.product.count({ where: { outletId } }),
    ])
    const totalRevenue = revenueResult._sum.total ?? 0
    const totalTransactions = totalTxCount

    // ── Low stock products ──
    const lowStockProducts = await db.product.findMany({
      where: { outletId },
      orderBy: { stock: 'asc' },
      select: { id: true, name: true, stock: true, lowStockAlert: true },
    })
    const lowStockList = lowStockProducts.filter((p) => p.stock <= p.lowStockAlert)

    // ── Top 5 customers ──
    const topCustomers = await db.customer.findMany({
      where: { outletId },
      orderBy: { totalSpend: 'desc' },
      take: 5,
    })

    // ── Today's metrics ──
    const todayTransactions = await db.transaction.findMany({
      where: {
        outletId,
        createdAt: { gte: todayStart },
      },
      select: {
        subtotal: true,
        discount: true,
        total: true,
        createdAt: true,
        items: {
          select: { price: true, hpp: true, qty: true },
        },
      },
    })

    const todayBrutto = todayTransactions.reduce((s, t) => s + t.subtotal, 0)
    const todayDiscount = todayTransactions.reduce((s, t) => s + t.discount, 0)
    const todayRevenue = todayTransactions.reduce((s, t) => s + t.total, 0)
    const todayTxCount = todayTransactions.length

    // ── Yesterday's metrics ──
    const yesterdayTransactions = await db.transaction.findMany({
      where: {
        outletId,
        createdAt: { gte: yesterdayStart, lt: todayStart },
      },
      select: {
        total: true,
      },
    })
    const yesterdayRevenue = yesterdayTransactions.reduce((s, t) => s + t.total, 0)
    const yesterdayTxCount = yesterdayTransactions.length

    const revenueChangePercent =
      yesterdayRevenue > 0
        ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
        : todayRevenue > 0
          ? 100
          : 0

    // ── OWNER-ONLY fields ──
    let totalProfit = 0
    let todayProfit = 0
    let peakHours: HourBucket[] = []
    let aiInsight: string | null = null

    if (isOwner) {
      // All-time profit
      const allItems = await db.transactionItem.findMany({
        where: { transaction: { outletId } },
        select: { price: true, hpp: true, qty: true },
      })
      totalProfit = allItems.reduce((s, i) => s + (i.price - i.hpp) * i.qty, 0)

      // Today's profit
      todayProfit = todayTransactions.reduce((s, t) => {
        return (
          s +
          t.items.reduce((itemSum, i) => itemSum + (i.price - i.hpp) * i.qty, 0)
        )
      }, 0)

      // Peak hours — group today's transactions by hour
      const buckets: HourBucket[] = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        transactionCount: 0,
        revenue: 0,
      }))
      for (const t of todayTransactions) {
        const hour = t.createdAt.getHours()
        buckets[hour].transactionCount += 1
        buckets[hour].revenue += t.total
      }
      peakHours = buckets

      // AI Insight placeholder
      aiInsight = 'AI insight requires Z.AI GLM 5 integration'
    }

    return safeJson({
      // All-time
      totalRevenue,
      totalTransactions,
      totalProducts,
      lowStockProducts: lowStockList.length,
      lowStockList,
      topCustomers,
      totalProfit: isOwner ? totalProfit : null,

      // Today
      todayRevenue,
      todayBrutto,
      todayDiscount,
      todayTransactions: todayTxCount,
      todayProfit: isOwner ? todayProfit : null,

      // Yesterday comparison
      yesterdayRevenue,
      yesterdayTransactions: yesterdayTxCount,
      revenueChangePercent,

      // OWNER-ONLY Pro features
      peakHours: isOwner ? peakHours : null,
      aiInsight: isOwner ? aiInsight : null,
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return safeJsonError('Failed to load dashboard stats')
  }
}
