import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { getOutletPlan } from '@/lib/plan-config'
import { safeJson, safeJsonError } from '@/lib/safe-response'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return unauthorized()

    const outletId = user.outletId

    // Check plan feature gate
    const planData = await getOutletPlan(outletId, db)
    if (!planData || !planData.features.transactionSummary) {
      return safeJsonError('Fitur ringkasan transaksi hanya tersedia untuk akun Pro', 403)
    }

    const { searchParams } = request.nextUrl
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const filterOutletId = searchParams.get('outletId') || outletId

    // Build date filter
    const dateFilter: Record<string, unknown> = {}
    if (dateFrom) {
      const start = new Date(dateFrom)
      start.setHours(0, 0, 0, 0)
      dateFilter.gte = start
    }
    if (dateTo) {
      const end = new Date(dateTo)
      end.setHours(23, 59, 59, 999)
      dateFilter.lte = end
    }

    // Build base where clause
    const baseWhere: Record<string, unknown> = { outletId: filterOutletId }
    if (Object.keys(dateFilter).length > 0) {
      baseWhere.createdAt = dateFilter
    }

    // Get all voided transaction IDs for this outlet
    const voidedTxIds = await db.auditLog.findMany({
      where: {
        entityType: 'TRANSACTION',
        action: 'VOID',
        outletId: filterOutletId,
      },
      select: { entityId: true },
    })
    const voidedIdSet = new Set(voidedTxIds.map((v) => v.entityId))

    // Exclude voided transactions
    const activeWhere = { ...baseWhere }
    if (voidedIdSet.size > 0) {
      activeWhere.id = { notIn: Array.from(voidedIdSet) as string[] }
    }

    // Fetch all active transactions for the date range (for aggregation)
    const transactions = await db.transaction.findMany({
      where: activeWhere,
      select: {
        id: true,
        total: true,
        paymentMethod: true,
        items: {
          select: {
            productId: true,
            productName: true,
            price: true,
            qty: true,
            subtotal: true,
          },
        },
      },
    })

    // Calculate summary metrics
    const totalRevenue = transactions.reduce((sum, t) => sum + t.total, 0)
    const totalTransactions = transactions.length
    const avgTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0

    // Payment method breakdown
    const paymentMap = new Map<string, { count: number; total: number }>()
    for (const t of transactions) {
      const method = t.paymentMethod
      const existing = paymentMap.get(method) || { count: 0, total: 0 }
      existing.count += 1
      existing.total += t.total
      paymentMap.set(method, existing)
    }
    const paymentBreakdown = Array.from(paymentMap.entries()).map(([method, data]) => ({
      method,
      count: data.count,
      total: data.total,
    }))

    // Top products by revenue
    const productRevenue = new Map<string, { name: string; quantity: number; revenue: number }>()
    for (const t of transactions) {
      for (const item of t.items) {
        const existing = productRevenue.get(item.productId) || {
          name: item.productName,
          quantity: 0,
          revenue: 0,
        }
        existing.quantity += item.qty
        existing.revenue += item.subtotal
        productRevenue.set(item.productId, existing)
      }
    }
    const topProducts = Array.from(productRevenue.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((p, index) => ({
        rank: index + 1,
        name: p.name,
        quantity: p.quantity,
        revenue: p.revenue,
      }))

    return safeJson({
      totalRevenue,
      totalTransactions,
      avgTransaction,
      paymentBreakdown,
      topProducts,
    })
  } catch (error) {
    console.error('Transaction summary GET error:', error)
    return safeJsonError('Failed to load transaction summary', 500)
  }
}
