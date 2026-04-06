import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { generateInvoiceNumber, resolvePlanType } from '@/lib/api-helpers'
import { notifyNewTransaction } from '@/lib/notify'
import { getPlanFeatures, isUnlimited } from '@/lib/plan-config'
import { safeJson, safeJsonError } from '@/lib/safe-response'

interface CheckoutItem {
  productId: string
  productName: string
  price: number
  qty: number
  subtotal?: number
  variantId?: string
  variantName?: string
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
      promoId,
      promoDiscount,
      taxAmount,
    } = body

    // Validate items
    if (!items || items.length === 0) {
      return safeJsonError('Cart is empty', 400)
    }

    const checkoutItems: CheckoutItem[] = items

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
      // 1. Collect all variant IDs and product IDs
      const variantIds = checkoutItems
        .filter((item) => item.variantId)
        .map((item) => item.variantId!)
      const productIds = checkoutItems.map((item) => item.productId)

      // Batch fetch products and variants
      const [products, variants] = await Promise.all([
        tx.product.findMany({
          where: { id: { in: productIds }, outletId },
        }),
        variantIds.length > 0
          ? tx.productVariant.findMany({
              where: { id: { in: variantIds }, outletId },
            })
          : ([] as Array<{ id: string; productId: string; stock: number; hpp: number }>),
      ])

      const productMap = new Map<string, typeof products[number]>()
      for (const p of products) productMap.set(p.id, p)
      const variantMap = new Map<string, typeof variants[number]>()
      for (const v of variants) variantMap.set(v.id, v)

      // 2. Validate all items
      for (const item of checkoutItems) {
        const product = productMap.get(item.productId)
        if (!product) {
          throw new Error(`Product ${item.productName} not found`)
        }

        if (item.variantId) {
          // Validate variant exists and belongs to the correct product
          const variant = variantMap.get(item.variantId)
          if (!variant) {
            throw new Error(`Variant ${item.variantName || item.variantId} not found`)
          }
          if (variant.productId !== item.productId) {
            throw new Error(`Variant ${item.variantName || item.variantId} does not belong to product ${item.productName}`)
          }
          if (variant.stock < item.qty) {
            throw new Error(
              `Insufficient stock for ${item.productName} - ${item.variantName}. Available: ${variant.stock}, Requested: ${item.qty}`
            )
          }
        } else {
          // No variant — check parent product stock
          if (product.stock < item.qty) {
            throw new Error(
              `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.qty}`
            )
          }
        }
      }

      // 3. Validate payment for CASH
      if (paymentMethod === 'CASH') {
        if (paidAmount < total) {
          throw new Error('Insufficient payment amount')
        }
      }

      // 4. Generate invoice number
      const invoiceNumber = generateInvoiceNumber()

      // Check for invoice uniqueness
      const existingInvoice = await tx.transaction.findUnique({
        where: { invoiceNumber },
      })
      if (existingInvoice) {
        throw new Error('Invoice number collision — please try again')
      }

      // 5. Create Transaction record
      const transaction = await tx.transaction.create({
        data: {
          invoiceNumber,
          subtotal,
          discount: discount || 0,
          pointsUsed: pointsUsed || 0,
          taxAmount: taxAmount || 0,
          total,
          paymentMethod,
          paidAmount: paidAmount || 0,
          change: change || 0,
          outletId,
          customerId: customerId || null,
          userId,
        },
      })

      // 6. Batch create TransactionItems
      const itemData = checkoutItems.map((item) => {
        const product = productMap.get(item.productId)!
        const variant = item.variantId ? variantMap.get(item.variantId) : null

        return {
          productId: item.productId,
          productName: item.productName,
          variantId: item.variantId || null,
          variantName: item.variantName || null,
          price: item.price,
          qty: item.qty,
          subtotal: item.price * item.qty,
          hpp: variant ? variant.hpp : product.hpp,
          transactionId: transaction.id,
        }
      })

      await tx.transactionItem.createMany({ data: itemData })

      // 7. Batch update stock (variant stock or parent product stock)
      for (const item of checkoutItems) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { decrement: item.qty } },
          })
        } else {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.qty } },
          })
        }
      }

      // 8. Batch create audit logs
      const auditData = checkoutItems.map((item) => {
        const product = productMap.get(item.productId)!
        const variant = item.variantId ? variantMap.get(item.variantId) : null

        if (variant) {
          return {
            action: 'SALE' as const,
            entityType: 'VARIANT' as const,
            entityId: item.variantId,
            details: JSON.stringify({
              invoiceNumber,
              productName: item.productName,
              variantName: item.variantName,
              quantitySold: item.qty,
              previousStock: variant.stock,
              newStock: variant.stock - item.qty,
            }),
            outletId,
            userId,
          }
        }

        return {
          action: 'SALE' as const,
          entityType: 'PRODUCT' as const,
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
        }
      })
      if (auditData.length > 0) {
        await tx.auditLog.createMany({ data: auditData })
      }

      // 9. Handle customer loyalty
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

        // Calculate earned points based on outlet loyalty settings
        let earnedPoints = 0
        const setting = await tx.outletSetting.findUnique({
          where: { outletId },
          select: { loyaltyEnabled: true, loyaltyPointsPerAmount: true },
        })
        if (setting?.loyaltyEnabled && setting.loyaltyPointsPerAmount > 0) {
          earnedPoints = Math.floor(total / setting.loyaltyPointsPerAmount)
        }

        // Combine customer updates into a single query
        const customerUpdateData: { totalSpend: { increment: number }; points?: { increment: number } | { decrement: number } } = {
          totalSpend: { increment: total },
        }
        let netPointsDelta = 0
        if (earnedPoints > 0) netPointsDelta += earnedPoints
        if (pointsToUse > 0) netPointsDelta -= pointsToUse
        if (netPointsDelta !== 0) {
          customerUpdateData.points = netPointsDelta > 0
            ? { increment: netPointsDelta }
            : { decrement: Math.abs(netPointsDelta) }
        }

        await tx.customer.update({
          where: { id: customerId },
          data: customerUpdateData,
        })

        // Create loyalty logs in batch
        const loyaltyLogs: Array<{
          type: 'EARN' | 'REDEEM'
          points: number
          description: string
          customerId: string
          transactionId: string
        }> = []
        if (earnedPoints > 0) {
          loyaltyLogs.push({
            type: 'EARN',
            points: earnedPoints,
            description: `Earned ${earnedPoints} points from transaction ${invoiceNumber} (Rp ${total.toLocaleString('id-ID')})`,
            customerId,
            transactionId: transaction.id,
          })
        }
        if (pointsToUse > 0) {
          const pointsDiscount = pointsToUse * 100
          loyaltyLogs.push({
            type: 'REDEEM',
            points: -pointsToUse,
            description: `Redeemed ${pointsToUse} points for Rp ${pointsDiscount.toLocaleString('id-ID')} discount on transaction ${invoiceNumber}`,
            customerId,
            transactionId: transaction.id,
          })
        }
        if (loyaltyLogs.length > 0) {
          await tx.loyaltyLog.createMany({ data: loyaltyLogs })
        }
      }

      return { invoiceNumber }
    }, { timeout: 15000 })

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
        items: checkoutItems.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          variantId: item.variantId || undefined,
          variantName: item.variantName || undefined,
          price: item.price,
          qty: item.qty,
          subtotal: item.subtotal || item.price * item.qty,
        })),
        subtotal,
        discount: discount || 0,
        taxAmount: taxAmount || 0,
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
