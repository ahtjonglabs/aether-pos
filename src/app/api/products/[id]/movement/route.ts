import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { parsePagination } from '@/lib/api-helpers'
import { safeJson, safeJsonError } from '@/lib/safe-response'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return unauthorized()
    }
    const outletId = user.outletId

    const { id } = await params

    // Verify product belongs to this outlet
    const product = await db.product.findFirst({
      where: { id, outletId },
    })
    if (!product) {
      return safeJsonError('Product not found', 404)
    }

    const { limit, skip } = parsePagination(request.nextUrl.searchParams)

    // Fetch summary stats and movement logs in parallel
    const [auditLogs, totalLogs, totalSoldResult, lastRestockLog] =
      await Promise.all([
        // Audit logs for this product (restock, create, update, sale, adjustments)
        db.auditLog.findMany({
          where: {
            entityId: id,
            entityType: 'PRODUCT',
            outletId,
          },
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        db.auditLog.count({
          where: {
            entityId: id,
            entityType: 'PRODUCT',
            outletId,
          },
        }),
        // Total sold qty and revenue from transaction items
        db.transactionItem.aggregate({
          where: { productId: id },
          _sum: { qty: true, subtotal: true },
        }),
        // Last RESTOCK log date for stock aging
        db.auditLog.findFirst({
          where: {
            entityId: id,
            entityType: 'PRODUCT',
            action: 'RESTOCK',
            outletId,
          },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ])

    // Get restock total via aggregate instead of fetching all logs
    const restockTotalResult = await db.auditLog.aggregate({
      where: {
        entityId: id,
        entityType: 'PRODUCT',
        action: 'RESTOCK',
        outletId,
      },
      _count: { id: true },
    })

    // Parse restock quantities from audit log details (only fetch details column)
    const restockDetails = await db.auditLog.findMany({
      where: {
        entityId: id,
        entityType: 'PRODUCT',
        action: 'RESTOCK',
        outletId,
      },
      select: { details: true },
    })
    let totalRestocked = 0
    for (const log of restockDetails) {
      try {
        const details = JSON.parse(log.details || '{}')
        totalRestocked += Number(details.quantityAdded) || 0
      } catch {
        // Skip malformed details
      }
    }

    const totalSold = totalSoldResult._sum.qty || 0
    const revenue = totalSoldResult._sum.subtotal || 0

    // Build movement entries from audit logs
    const movements = auditLogs.map((log) => {
      let parsedDetails: Record<string, unknown> = {}
      try {
        parsedDetails = JSON.parse(log.details || '{}')
      } catch {
        // Keep empty
      }

      return {
        id: log.id,
        action: log.action,
        details: parsedDetails,
        user: log.user,
        createdAt: log.createdAt,
      }
    })

    return safeJson({
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        hpp: product.hpp,
        price: product.price,
        stock: product.stock,
        lowStockAlert: product.lowStockAlert,
        image: product.image,
      },
      summary: {
        totalSold,
        totalRestocked,
        currentStock: product.stock,
        revenue,
        lastRestockDate: lastRestockLog?.createdAt?.toISOString() || null,
      },
      movements,
      totalPages: Math.ceil(totalLogs / limit),
      totalLogs,
    })
  } catch (error) {
    console.error('Product movement GET error:', error)
    return safeJsonError('Failed to load product movement')
  }
}
