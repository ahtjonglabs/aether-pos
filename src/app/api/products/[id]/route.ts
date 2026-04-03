import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { safeAuditLog } from '@/lib/safe-audit'
import { safeJson, safeJsonError } from '@/lib/safe-response'

export async function PUT(
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

    const existing = await db.product.findFirst({
      where: { id, outletId },
    })
    if (!existing) {
      return safeJsonError('Product not found', 404)
    }

    const body = await request.json()
    const { name, sku, hpp, price, stock, lowStockAlert, image, unit, categoryId } = body

    // Check unique name if changed
    if (name && name !== existing.name) {
      const nameExists = await db.product.findFirst({
        where: { name, outletId },
      })
      if (nameExists) {
        return safeJsonError('Product name already exists in this outlet', 400)
      }
    }

    const product = await db.$transaction(async (tx) => {
      // Track changes for audit log
      const changes: Record<string, { from: unknown; to: unknown }> = {}
      if (name !== undefined && name !== existing.name) changes.name = { from: existing.name, to: name }
      if (hpp !== undefined && hpp !== existing.hpp) changes.hpp = { from: existing.hpp, to: hpp }
      if (price !== undefined && price !== existing.price) changes.price = { from: existing.price, to: price }
      if (lowStockAlert !== undefined && lowStockAlert !== existing.lowStockAlert) changes.lowStockAlert = { from: existing.lowStockAlert, to: lowStockAlert }
      if (stock !== undefined && stock !== existing.stock) changes.stock = { from: existing.stock, to: stock }
      if (image !== undefined && image !== existing.image) changes.image = { from: existing.image, to: image }
      if (unit !== undefined && unit !== existing.unit) changes.unit = { from: existing.unit, to: unit }

      const updateData: Record<string, unknown> = {}
      if (name !== undefined) updateData.name = name
      if (sku !== undefined) updateData.sku = sku || null
      if (hpp !== undefined) updateData.hpp = hpp
      if (price !== undefined) updateData.price = price
      if (stock !== undefined) updateData.stock = stock
      if (lowStockAlert !== undefined) updateData.lowStockAlert = lowStockAlert
      if (image !== undefined) updateData.image = image || null
      if (unit !== undefined) updateData.unit = unit || 'pcs'
      if (categoryId !== undefined) updateData.categoryId = categoryId || null

      const updated = await tx.product.update({
        where: { id },
        data: updateData,
      })

      // Create audit log only if there are actual changes
      if (Object.keys(changes).length > 0) {
        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'PRODUCT',
            entityId: id,
            details: JSON.stringify({ productName: updated.name, changes }),
            outletId,
            userId: user.id,
          },
        })
      }

      return updated
    })

    return safeJson(product)
  } catch (error) {
    console.error('Product PUT error:', error)
    return safeJsonError('Failed to update product')
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return unauthorized()
    }
    const outletId = user.outletId
    const userId = user.id

    const { id } = await params

    const existing = await db.product.findFirst({
      where: { id, outletId },
    })
    if (!existing) {
      return safeJsonError('Product not found', 404)
    }

    // Create audit log before deleting (non-blocking)
    await safeAuditLog({
      action: 'DELETE',
      entityType: 'PRODUCT',
      entityId: id,
      details: JSON.stringify({
        productName: existing.name,
        price: existing.price,
        stock: existing.stock,
        sku: existing.sku,
      }),
      outletId,
      userId,
    })

    await db.product.delete({
      where: { id },
    })

    return safeJson({ success: true })
  } catch (error) {
    console.error('Product DELETE error:', error)
    return safeJsonError('Failed to delete product')
  }
}
