import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { safeJson, safeJsonError } from '@/lib/safe-response'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return unauthorized()
    }
    const outletId = user.outletId
    const userId = user.id

    const { id, variantId } = await params

    // Verify variant belongs to this outlet and product
    const existing = await db.productVariant.findFirst({
      where: { id: variantId, productId: id, outletId },
    })
    if (!existing) {
      return safeJsonError('Variant not found', 404)
    }

    const body = await request.json()
    const { name, sku, price, hpp, stock, lowStockAlert } = body

    // Check unique name if changed
    if (name && name !== existing.name) {
      const nameExists = await db.productVariant.findFirst({
        where: { name, productId: id },
      })
      if (nameExists) {
        return safeJsonError('Variant name already exists for this product', 400)
      }
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (sku !== undefined) updateData.sku = sku || null
    if (price !== undefined) updateData.price = Number(price)
    if (hpp !== undefined) updateData.hpp = Number(hpp)
    if (stock !== undefined) updateData.stock = Number(stock)
    if (lowStockAlert !== undefined) updateData.lowStockAlert = Number(lowStockAlert)

    const variant = await db.productVariant.update({
      where: { id: variantId },
      data: updateData,
    })

    // Fire-and-forget audit log
    const { safeAuditLog } = await import('@/lib/safe-audit')
    const product = await db.product.findFirst({
      where: { id },
      select: { name: true },
    })
    safeAuditLog({
      action: 'UPDATE',
      entityType: 'PRODUCT',
      entityId: id,
      details: JSON.stringify({
        productName: product?.name,
        changes: { variantUpdated: { from: existing.name, to: name || existing.name, price } },
      }),
      outletId,
      userId,
    }).catch(() => {})

    return safeJson(variant)
  } catch (error) {
    console.error('Variant PUT error:', error)
    return safeJsonError('Failed to update variant')
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return unauthorized()
    }
    const outletId = user.outletId
    const userId = user.id

    const { id, variantId } = await params

    // Verify variant belongs to this outlet and product
    const existing = await db.productVariant.findFirst({
      where: { id: variantId, productId: id, outletId },
    })
    if (!existing) {
      return safeJsonError('Variant not found', 404)
    }

    await db.productVariant.delete({
      where: { id: variantId },
    })

    // Fire-and-forget audit log
    const { safeAuditLog } = await import('@/lib/safe-audit')
    const product = await db.product.findFirst({
      where: { id },
      select: { name: true },
    })
    safeAuditLog({
      action: 'UPDATE',
      entityType: 'PRODUCT',
      entityId: id,
      details: JSON.stringify({
        productName: product?.name,
        changes: { variantDeleted: { name: existing.name } },
      }),
      outletId,
      userId,
    }).catch(() => {})

    return safeJson({ success: true })
  } catch (error) {
    console.error('Variant DELETE error:', error)
    return safeJsonError('Failed to delete variant')
  }
}
