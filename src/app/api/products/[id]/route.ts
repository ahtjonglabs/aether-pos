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
    const { name, sku, hpp, price, stock, lowStockAlert, image, unit, categoryId, hasVariants, variants } = body

    // Check unique name if changed
    if (name && name !== existing.name) {
      const nameExists = await db.product.findFirst({
        where: { name, outletId },
      })
      if (nameExists) {
        return safeJsonError('Product name already exists in this outlet', 400)
      }
    }

    // If toggling hasVariants OFF, delete all variants
    if (hasVariants === false && existing.hasVariants) {
      await db.productVariant.deleteMany({
        where: { productId: id, outletId },
      })
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
      if (hasVariants !== undefined && hasVariants !== existing.hasVariants) changes.hasVariants = { from: existing.hasVariants, to: hasVariants }

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
      if (hasVariants !== undefined) updateData.hasVariants = hasVariants

      const updated = await tx.product.update({
        where: { id },
        data: updateData,
      })

      // Handle bulk variant update if provided
      if (variants && Array.isArray(variants)) {
        // Delete all existing variants for this product
        await tx.productVariant.deleteMany({
          where: { productId: id, outletId },
        })

        // Create new variants from the array
        if (variants.length > 0) {
          // Validate unique names
          const variantNames = new Set<string>()
          for (const v of variants) {
            if (variantNames.has(v.name)) {
              throw new Error(`Duplicate variant name: ${v.name}`)
            }
            variantNames.add(v.name)
          }

          await tx.productVariant.createMany({
            data: variants.map((v: Record<string, unknown>) => ({
              name: v.name as string,
              sku: (v.sku as string) || null,
              price: Number(v.price),
              hpp: Number(v.hpp) || 0,
              stock: Number(v.stock) || 0,
              lowStockAlert: Number(v.lowStockAlert) || 10,
              productId: id,
              outletId,
            })),
          })
        }
      }

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

    // Fetch updated variants to return
    const updatedVariants = await db.productVariant.findMany({
      where: { productId: id, outletId },
      orderBy: { createdAt: 'asc' },
    })

    return safeJson({ ...product, variants: updatedVariants })
  } catch (error) {
    console.error('Product PUT error:', error)
    const message = error instanceof Error ? error.message : 'Failed to update product'
    return safeJsonError(message, 400)
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
    if (user.role !== 'OWNER') {
      return safeJsonError('Hanya pemilik yang dapat menghapus produk', 403)
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
        hasVariants: existing.hasVariants,
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
