import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { generateInvoiceNumber } from '@/lib/api-helpers'
import { safeJson, safeJsonError } from '@/lib/safe-response'

interface SyncTransaction {
  id?: number
  payload: {
    customerId: string | null
    items: Array<{
      productId: string
      productName: string
      price: number
      qty: number
      subtotal: number
    }>
    subtotal: number
    discount: number
    pointsUsed: number
    total: number
    paymentMethod: string
    paidAmount: number
    change: number
  }
  createdAt: number // timestamp
}

interface SyncResult {
  localId: number
  success: boolean
  invoiceNumber?: string
  serverId?: string
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return unauthorized()
    }
    const userId = user.id
    const outletId = user.outletId

    const body = await request.json()
    const { transactions }: { transactions: SyncTransaction[] } = body

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return safeJsonError('No transactions to sync', 400)
    }

    // Limit batch size to 50
    const batch = transactions.slice(0, 50)
    const results: SyncResult[] = []

    for (const tx of batch) {
      try {
        const { payload, createdAt } = tx

        // Validate items
        if (!payload.items || payload.items.length === 0) {
          results.push({ localId: tx.id!, success: false, error: 'Empty cart' })
          continue
        }

        const transactionDate = new Date(createdAt)

        const result = await db.$transaction(async (txDb) => {
          // 1. Validate all products exist and have enough stock
          const productIds = payload.items.map((item) => item.productId)
          // H2: Filter products by outletId to prevent cross-outlet sync
          const products = await txDb.product.findMany({
            where: { id: { in: productIds }, outletId },
          })

          const productMap = new Map(products.map((p) => [p.id, p]))

          for (const item of payload.items) {
            const product = productMap.get(item.productId)
            if (!product) {
              throw new Error(`Product ${item.productName} not found in this outlet`)
            }
            if (product.stock < item.qty) {
              throw new Error(
                `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.qty}`
              )
            }
          }

          // 2. Validate payment for CASH
          if (payload.paymentMethod === 'CASH') {
            if (payload.paidAmount < payload.total) {
              throw new Error('Insufficient payment amount')
            }
          }

          // 3. Generate invoice number
          const invoiceNumber = generateInvoiceNumber()

          // 3b. Check for invoice uniqueness
          const existingInvoice = await txDb.transaction.findUnique({
            where: { invoiceNumber },
          })
          if (existingInvoice) {
            throw new Error('Invoice number collision — please try again')
          }

          // 4. Create Transaction record
          const transaction = await txDb.transaction.create({
            data: {
              invoiceNumber,
              subtotal: payload.subtotal,
              discount: payload.discount || 0,
              pointsUsed: payload.pointsUsed || 0,
              total: payload.total,
              paymentMethod: payload.paymentMethod,
              paidAmount: payload.paidAmount || 0,
              change: payload.change || 0,
              outletId,
              customerId: payload.customerId || null,
              userId,
              createdAt: transactionDate,
            },
          })

          // 5. Create TransactionItem records, decrease stock, create audit logs
          for (const item of payload.items) {
            const product = productMap.get(item.productId)!

            await txDb.transactionItem.create({
              data: {
                productId: item.productId,
                productName: item.productName,
                price: item.price,
                qty: item.qty,
                subtotal: item.subtotal,
                hpp: product.hpp,
                transactionId: transaction.id,
              },
            })

            // Decrease stock
            await txDb.product.update({
              where: { id: item.productId },
              data: { stock: { decrement: item.qty } },
            })

            // Create AuditLog for stock decrease
            await txDb.auditLog.create({
              data: {
                action: 'SALE',
                entityType: 'PRODUCT',
                entityId: item.productId,
                details: JSON.stringify({
                  invoiceNumber,
                  productName: item.productName,
                  quantitySold: item.qty,
                  previousStock: product.stock,
                  newStock: product.stock - item.qty,
                  syncedFromOffline: true,
                  originalCreatedAt: createdAt,
                }),
                outletId,
                userId,
                createdAt: transactionDate,
              },
            })
          }

          // 6. Handle customer loyalty
          if (payload.customerId) {
            const customer = await txDb.customer.findFirst({
              where: { id: payload.customerId, outletId },
            })
            if (!customer) {
              throw new Error('Customer not found')
            }

            const pointsToUse = payload.pointsUsed || 0

            if (pointsToUse > customer.points) {
              throw new Error(
                `Insufficient points. Available: ${customer.points}, Requested: ${pointsToUse}`
              )
            }

            await txDb.customer.update({
              where: { id: payload.customerId },
              data: { totalSpend: { increment: payload.total } },
            })

            // Calculate earned points based on outlet loyalty settings
            let earnedPoints = 0
            const syncSetting = await txDb.outletSetting.findUnique({
              where: { outletId },
              select: { loyaltyEnabled: true, loyaltyPointsPerAmount: true },
            })
            if (syncSetting?.loyaltyEnabled && syncSetting.loyaltyPointsPerAmount > 0) {
              earnedPoints = Math.floor(payload.total / syncSetting.loyaltyPointsPerAmount)
            }

            if (earnedPoints > 0) {
              await txDb.customer.update({
                where: { id: payload.customerId },
                data: { points: { increment: earnedPoints } },
              })

              await txDb.loyaltyLog.create({
                data: {
                  type: 'EARN',
                  points: earnedPoints,
                  description: `Earned ${earnedPoints} points from transaction ${invoiceNumber} (Rp ${payload.total.toLocaleString('id-ID')}) [synced offline]`,
                  customerId: payload.customerId,
                  transactionId: transaction.id,
                  createdAt: transactionDate,
                },
              })
            }

            if (pointsToUse > 0) {
              await txDb.customer.update({
                where: { id: payload.customerId },
                data: { points: { decrement: pointsToUse } },
              })

              const pointsDiscount = pointsToUse * 100

              await txDb.loyaltyLog.create({
                data: {
                  type: 'REDEEM',
                  points: -pointsToUse,
                  description: `Redeemed ${pointsToUse} points for Rp ${pointsDiscount.toLocaleString('id-ID')} discount on transaction ${invoiceNumber} [synced offline]`,
                  customerId: payload.customerId,
                  transactionId: transaction.id,
                  createdAt: transactionDate,
                },
              })
            }
          }

          return { transactionId: transaction.id, invoiceNumber }
        })

        results.push({
          localId: tx.id!,
          success: true,
          invoiceNumber: result.invoiceNumber,
          serverId: result.transactionId,
        })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Sync failed'
        results.push({
          localId: tx.id!,
          success: false,
          error: message,
        })
      }
    }

    const synced = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length

    return safeJson({
      synced,
      failed,
      total: batch.length,
      results,
    })
  } catch (error) {
    console.error('Transactions sync error:', error)
    return safeJsonError('Sync failed', 500)
  }
}
