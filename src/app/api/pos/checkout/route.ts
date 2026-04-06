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
      promoId,
      promoDiscount,
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
        where: { id: { in: productIds }, outletId },
      })

      const productMap = new Map(products.map((p) => [p.id, p]))

      // Also fetch variants referenced by items for stock validation
      const variantIds = items
        .map((item: { variantId?: string | null }) => item.variantId)
        .filter((id): id is string => !!id)

      const variantMap = new Map<string, { id: string; name: string; stock: number }>()
      if (variantIds.length > 0) {
        const variants = await tx.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: { id: true, name: true, stock: true },
        })
        for (const v of variants) {
          variantMap.set(v.id, v)
        }
      }

      for (const item of items) {
        const product = productMap.get(item.productId)
        if (!product) {
          throw new Error(`Product ${item.productName} not found`)
        }

        if (item.variantId) {
          // For variant items, check variant stock
          const variant = variantMap.get(item.variantId)
          if (!variant) {
            throw new Error(`Variant ${item.variantName || item.variantId} not found`)
          }
          if (variant.stock < item.qty) {
            throw new Error(
              `Insufficient stock for ${product.name} - ${variant.name}. Available: ${variant.stock}, Requested: ${item.qty}`
            )
          }
        } else {
          // For non-variant items, check parent product stock
          if (product.stock < item.qty) {
            throw new Error(
              `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.qty}`
            )
          }
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

      // 5. Batch create TransactionItems, batch update stocks, batch create audit logs
      const itemData = items.map((item: { productId: string; productName: string; price: number; qty: number; variantId?: string | null; variantName?: string | null }) => {
        const product = productMap.get(item.productId)!
        return {
          productId: item.productId,
          productName: item.productName,
          variantId: item.variantId || null,
          variantName: item.variantName || null,
          price: item.price,
          qty: item.qty,
          subtotal: item.price * item.qty,
          hpp: product.hpp,
          transactionId: transaction.id,
        }
      })

      await tx.transactionItem.createMany({ data: itemData })

      // Batch update stock for all items (for variant items, update variant stock)
      for (const item of items) {
        if (item.variantId) {
          // Update variant stock
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { decrement: item.qty } },
          })
        } else {
          // Update product stock
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.qty } },
          })
        }
      }

      // Batch create audit logs
      const auditData = items.map((item: { productId: string; productName: string; price: number; qty: number; variantId?: string | null; variantName?: string | null }) => {
        const product = productMap.get(item.productId)!
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
            variantId: item.variantId || undefined,
            variantName: item.variantName || undefined,
          }),
          outletId,
          userId,
        }
      })
      if (auditData.length > 0) {
        await tx.auditLog.createMany({ data: auditData })
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
        const loyaltyLogs = []
        if (earnedPoints > 0) {
          loyaltyLogs.push({
            type: 'EARN' as const,
            points: earnedPoints,
            description: `Earned ${earnedPoints} points from transaction ${invoiceNumber} (Rp ${total.toLocaleString('id-ID')})`,
            customerId,
            transactionId: transaction.id,
          })
        }
        if (pointsToUse > 0) {
          const pointsDiscount = pointsToUse * 100
          loyaltyLogs.push({
            type: 'REDEEM' as const,
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
