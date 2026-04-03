import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return unauthorized()
    }
    if (user.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Only OWNER can bulk update products' },
        { status: 403 }
      )
    }
    const outletId = user.outletId
    const userId = user.id

    const body = await request.json()
    const { productIds, priceAdjustment, stockAdjustment } = body

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: 'productIds is required and must be a non-empty array' },
        { status: 400 }
      )
    }

    if (productIds.length > 200) {
      return NextResponse.json(
        { error: 'Maximum 200 products per bulk update' },
        { status: 400 }
      )
    }

    if (!priceAdjustment && !stockAdjustment) {
      return NextResponse.json(
        { error: 'At least one adjustment type (priceAdjustment or stockAdjustment) is required' },
        { status: 400 }
      )
    }

    // Validate price adjustment
    if (priceAdjustment) {
      const { type, value } = priceAdjustment
      if (!['percent', 'fixed'].includes(type)) {
        return NextResponse.json(
          { error: 'priceAdjustment.type must be "percent" or "fixed"' },
          { status: 400 }
        )
      }
      if (typeof value !== 'number' || value === 0) {
        return NextResponse.json(
          { error: 'priceAdjustment.value must be a non-zero number' },
          { status: 400 }
        )
      }
    }

    // Validate stock adjustment
    if (stockAdjustment) {
      const { type, value } = stockAdjustment
      if (!['add', 'subtract', 'set'].includes(type)) {
        return NextResponse.json(
          { error: 'stockAdjustment.type must be "add", "subtract", or "set"' },
          { status: 400 }
        )
      }
      if (typeof value !== 'number' || value < 0) {
        return NextResponse.json(
          { error: 'stockAdjustment.value must be a non-negative number' },
          { status: 400 }
        )
      }
    }

    // Verify all products belong to this outlet
    const existingProducts = await db.product.findMany({
      where: { id: { in: productIds }, outletId },
      select: { id: true, name: true, price: true, stock: true },
    })

    if (existingProducts.length === 0) {
      return NextResponse.json(
        { error: 'No valid products found' },
        { status: 404 }
      )
    }

    // Process each product in a transaction
    let updatedCount = 0
    const auditLogs = []

    await db.$transaction(async (tx) => {
      for (const product of existingProducts) {
        const updates: Record<string, unknown> = {}
        const changes: Record<string, { from: number; to: number }> = {}

        // Price adjustment
        if (priceAdjustment) {
          const { type, value } = priceAdjustment
          const oldPrice = product.price
          let newPrice: number

          if (type === 'percent') {
            newPrice = Math.round(oldPrice * (1 + value / 100))
          } else {
            newPrice = Math.round(oldPrice + value)
          }

          // Ensure price doesn't go negative
          newPrice = Math.max(0, newPrice)
          updates.price = newPrice
          changes.price = { from: oldPrice, to: newPrice }
        }

        // Stock adjustment
        if (stockAdjustment) {
          const { type, value } = stockAdjustment
          const oldStock = product.stock
          let newStock: number

          if (type === 'add') {
            newStock = oldStock + Math.round(value)
          } else if (type === 'subtract') {
            newStock = Math.max(0, oldStock - Math.round(value))
          } else {
            newStock = Math.round(value)
          }

          updates.stock = newStock
          changes.stock = { from: oldStock, to: newStock }
        }

        await tx.product.update({
          where: { id: product.id },
          data: updates,
        })

        auditLogs.push({
          action: 'BULK_UPDATE',
          entityType: 'PRODUCT',
          entityId: product.id,
          details: JSON.stringify({
            productName: product.name,
            changes,
            batchOperation: true,
          }),
          outletId,
          userId,
        })

        updatedCount++
      }

      // Create all audit logs
      if (auditLogs.length > 0) {
        await tx.auditLog.createMany({
          data: auditLogs,
        })
      }
    })

    return NextResponse.json({ updated: updatedCount })
  } catch (error) {
    console.error('Products bulk update POST error:', error)
    return NextResponse.json(
      { error: 'Failed to bulk update products' },
      { status: 500 }
    )
  }
}
