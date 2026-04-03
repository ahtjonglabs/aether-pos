import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'

const PAGE_SIZE = 20

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return unauthorized()
    }
    const outletId = user.outletId

    const { searchParams } = request.nextUrl
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || PAGE_SIZE))
    const search = searchParams.get('search') || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const cashierId = searchParams.get('cashierId') || ''
    const paymentMethod = searchParams.get('paymentMethod') || ''
    const voidStatus = searchParams.get('voidStatus') || '' // 'void' or 'active'

    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { outletId }
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { customer: { name: { contains: search } } },
      ]
    }
    if (dateFrom || dateTo) {
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
      where.createdAt = dateFilter
    }
    if (cashierId) {
      where.userId = cashierId
    }
    if (paymentMethod) {
      where.paymentMethod = paymentMethod
    }

    // H3: If voidStatus filter, apply at DB level for accurate pagination
    // We need to find transaction IDs that have/haven't been voided
    if (voidStatus === 'void' || voidStatus === 'active') {
      // Get all voided transaction IDs for this outlet
      const voidedTxIds = await db.auditLog.findMany({
        where: {
          entityType: 'TRANSACTION',
          action: 'VOID',
          outletId,
        },
        select: { entityId: true },
      })
      const voidedIdSet = new Set(voidedTxIds.map((v) => v.entityId))
      if (voidStatus === 'void') {
        where.id = { in: Array.from(voidedIdSet) as string[] }
      } else {
        // active = all transactions NOT in voided set
        // For Prisma, we use a NOT IN approach
        if (voidedIdSet.size > 0) {
          where.id = { notIn: Array.from(voidedIdSet) as string[] }
        }
      }
    }

    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          invoiceNumber: true,
          subtotal: true,
          discount: true,
          total: true,
          paymentMethod: true,
          paidAmount: true,
          change: true,
          customer: {
            select: { name: true },
          },
          user: {
            select: { id: true, name: true },
          },
          createdAt: true,
          items: {
            select: { id: true },
          },
        },
      }),
      db.transaction.count({ where }),
    ])

    // Fetch all void logs for these transactions in bulk
    const transactionIds = transactions.map((t) => t.id)
    const voidLogs = transactionIds.length > 0
      ? await db.auditLog.findMany({
          where: {
            entityType: 'TRANSACTION',
            entityId: { in: transactionIds },
            action: 'VOID',
            outletId,
          },
          select: { entityId: true, details: true },
        })
      : []

    // Map void status for display
    const voidMap = new Map<string, { reason: string; voidedBy: string; voidedAt: string }>()
    for (const log of voidLogs) {
      try {
        const details = JSON.parse(log.details || '{}')
        voidMap.set(log.entityId!, {
          reason: details.reason || '',
          voidedBy: details.voidedBy || '',
          voidedAt: details.voidedAt || '',
        })
      } catch {
        voidMap.set(log.entityId!, { reason: '', voidedBy: '', voidedAt: '' })
      }
    }

    // H3: Map transactions with void info (no client-side filter needed now)
    const mappedTransactions = transactions.map((t) => {
      const voidInfo = voidMap.get(t.id)
      return {
        id: t.id,
        invoiceNumber: t.invoiceNumber,
        subtotal: t.subtotal,
        discount: t.discount,
        total: t.total,
        paymentMethod: t.paymentMethod,
        paidAmount: t.paidAmount,
        change: t.change,
        customerName: t.customer?.name ?? null,
        cashierName: t.user?.name ?? null,
        cashierId: t.user?.id ?? null,
        createdAt: t.createdAt,
        _count: { items: t.items.length },
        voidStatus: voidInfo ? 'void' : 'active',
        voidReason: voidInfo?.reason || null,
        syncStatus: 'synced' as const,
      }
    })

    return NextResponse.json({
      transactions: mappedTransactions,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Transactions GET error:', error)
    return NextResponse.json(
      { error: 'Failed to load transactions' },
      { status: 500 }
    )
  }
}
