import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { generateInvoiceNumber, resolvePlanType } from '@/lib/api-helpers'
import { notifyNewTransaction } from '@/lib/notify'
import { getPlanFeatures, isUnlimited } from '@/lib/plan-config'
import { safeJson, safeJsonError } from '@/lib/safe-response'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return unauthorized()
    }
    const userId = user.id
    const outletId = user.outletId

    const body = await request.json()
    const {
      customerId,
      items,
      subtotal,
      discount,
      pointsUsed,
      total,
      paymentMethod,
      paidAmount,
      change,
    } = body

    // Validate items
    if (!items || items.length === 0) {
      return safeJsonError('Cart is empty', 400)
    }

    // K4: Monthly transaction limit check
    const outlet = await db.outlet.findUnique({
      where: { id: outletId },
      select: { accountType: true },
    })
    const accountType = resolvePlanType(outlet?.accountType)
    const features = getPlanFeatures(accountType)
    if (!isUnlimited(features.maxTransactionsPerMonth)) {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthTxCount = await db.transaction.count({
        where: {
          outletId,
          createdAt: { gte: monthStart },
        },
      })
      if (monthTxCount >= features.maxTransactionsPerMonth) {
        return safeJsonError(`Batas transaksi bulanan untuk paket ${accountType} sudah tercapai (${features.maxTransactionsPerMonth}). Upgrade ke Pro untuk unlimited!`, 400)
      }
    }

    // K5: Validate paymentMethod against outlet settings
    if (paymentMethod) {
      const setting = await db.outletSetting.findUnique({
        where: { outletId },
        select: { paymentMethods: true },
      })
      if (setting?.paymentMethods) {
        const allowedMethods = setting.paymentMethods.split(',').map((m) => m.trim().toUpperCase())
        if (!allowedMethods.includes(paymentMethod.toUpperCase())) {
          return safeJsonError(`Metode pembayaran "${paymentMethod}" tidak tersedia. Metode yang diizinkan: ${setting.paymentMethods}`, 400)
        }
      }
    }

    const result = await db.$transaction(async (tx) => {
      // 1. Validate all products exist and have enough stock
      const productIds = items.map((item: { productId: string }) => item.productId)
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      })

      const productMap = new Map(products.map((p) => [p.id, p]))

      for (const item of items) {
        const product = productMap.get(item.productId)
        if (!product) {
          throw new Error(`Product ${item.productName} not found`)
        }
        if (product.stock < item.qty) {
          throw new Error(
            `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.qty}`
          )
        }
      }

      // 2. Validate payment for CASH
      if (paymentMethod === 'CASH') {
        if (paidAmount < total) {
          throw new Error('Insufficient payment amount')
        }
      }

      // 3. Generate invoice number
      const invoiceNumber = generateInvoiceNumber()

      // Check for invoice uniqueness
      const existingInvoice = await tx.transaction.findUnique({
        where: { invoiceNumber },
      })
      if (existingInvoice) {
        throw new Error('Invoice number collision — please try again')
      }

      // 4. Create Transaction record
      const transaction = await tx.transaction.create({
        data: {
          invoiceNumber,
          subtotal,
          discount: discount || 0,
          pointsUsed: pointsUsed || 0,
          total,
          paymentMethod,
          paidAmount: paidAmount || 0,
          change: change || 0,
          outletId,
          customerId: customerId || null,
          userId,
        },
      })

      // 5. Create TransactionItem records, decrease stock, create audit logs
      for (const item of items) {
        const product = productMap.get(item.productId)!
        const itemSubtotal = item.price * item.qty

        await tx.transactionItem.create({
          data: {
            productId: item.productId,
            productName: item.productName,
            price: item.price,
            qty: item.qty,
            subtotal: itemSubtotal,
            hpp: product.hpp,
            transactionId: transaction.id,
          },
        })

        // Decrease stock
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.qty } },
        })

        // Create AuditLog for stock decrease (action: SALE)
        await tx.auditLog.create({
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
            }),
            outletId,
            userId,
          },
        })
      }

      // 6. Handle customer loyalty
      if (customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: customerId, outletId },
        })
        if (!customer) {
          throw new Error('Customer not found')
        }

        const pointsToUse = pointsUsed || 0

        // Check points balance
        if (pointsToUse > customer.points) {
          throw new Error(
            `Insufficient points. Available: ${customer.points}, Requested: ${pointsToUse}`
          )
        }

        // Update totalSpend
        await tx.customer.update({
          where: { id: customerId },
          data: { totalSpend: { increment: total } },
        })

        // Calculate earned points based on outlet loyalty settings
        let earnedPoints = 0
        const setting = await tx.outletSetting.findUnique({
          where: { outletId },
          select: { loyaltyEnabled: true, loyaltyPointsPerAmount: true },
        })
        if (setting?.loyaltyEnabled && setting.loyaltyPointsPerAmount > 0) {
          earnedPoints = Math.floor(total / setting.loyaltyPointsPerAmount)
        }

        if (earnedPoints > 0) {
          await tx.customer.update({
            where: { id: customerId },
            data: { points: { increment: earnedPoints } },
          })

          await tx.loyaltyLog.create({
            data: {
              type: 'EARN',
              points: earnedPoints,
              description: `Earned ${earnedPoints} points from transaction ${invoiceNumber} (Rp ${total.toLocaleString('id-ID')})`,
              customerId,
              transactionId: transaction.id,
            },
          })
        }

        // Handle points redemption
        if (pointsToUse > 0) {
          await tx.customer.update({
            where: { id: customerId },
            data: { points: { decrement: pointsToUse } },
          })

          const pointsDiscount = pointsToUse * 100

          await tx.loyaltyLog.create({
            data: {
              type: 'REDEEM',
              points: -pointsToUse,
              description: `Redeemed ${pointsToUse} points for Rp ${pointsDiscount.toLocaleString('id-ID')} discount on transaction ${invoiceNumber}`,
              customerId,
              transactionId: transaction.id,
            },
          })
        }
      }

      return { invoiceNumber }
    })

    // H4: Post-transaction lookups for notification — wrapped in try/catch so a
    //     lookup failure never causes a "checkout failed" response when data was already saved.
    let cashierName = userId
    let outletName = 'Outlet'
    try {
      const [cashierUser, outletData, customerData] = await Promise.all([
        db.user.findUnique({ where: { id: userId }, select: { name: true } }),
        db.outlet.findUnique({ where: { id: outletId }, select: { name: true } }),
        customerId
          ? db.customer.findUnique({ where: { id: customerId }, select: { name: true } })
          : Promise.resolve(null),
      ])
      cashierName = cashierUser?.name || userId
      outletName = outletData?.name || 'Outlet'
      const customerName = customerData?.name || undefined

      notifyNewTransaction(outletId, {
        invoiceNumber: result.invoiceNumber,
        items: items.map((item: { productId: string; productName: string; price: number; qty: number; subtotal: number }) => ({
          productId: item.productId,
          productName: item.productName,
          price: item.price,
          qty: item.qty,
          subtotal: item.subtotal,
        })),
        subtotal,
        discount: discount || 0,
        total,
        paymentMethod,
        paidAmount: paidAmount || 0,
        change: change || 0,
        customerName,
        cashierName,
        outletName,
      })
    } catch (notifyError) {
      // Notification lookups / sending are best-effort; never fail the checkout
      console.error('Post-checkout notification error (non-fatal):', notifyError)
    }

    return safeJson({
      success: true,
      invoiceNumber: result.invoiceNumber,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Checkout failed'
    console.error('Checkout POST error:', error)
    return safeJsonError(message, 400)
  }
}
