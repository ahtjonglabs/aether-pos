import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'

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
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, sku, hpp, price, bruto, netto, lowStockAlert, image } = body

    // Check unique name if changed
    if (name && name !== existing.name) {
      const nameExists = await db.product.findFirst({
        where: { name, outletId },
      })
      if (nameExists) {
        return NextResponse.json(
          { error: 'Product name already exists in this outlet' },
          { status: 400 }
        )
      }
    }

    const product = await db.$transaction(async (tx) => {
      // Track changes for audit log
      const changes: Record<string, { from: unknown; to: unknown }> = {}
      if (name !== undefined && name !== existing.name) changes.name = { from: existing.name, to: name }
      if (hpp !== undefined && hpp !== existing.hpp) changes.hpp = { from: existing.hpp, to: hpp }
      if (price !== undefined && price !== existing.price) changes.price = { from: existing.price, to: price }
      if (bruto !== undefined && bruto !== existing.bruto) changes.bruto = { from: existing.bruto, to: bruto }
      if (netto !== undefined && netto !== existing.netto) changes.netto = { from: existing.netto, to: netto }
      if (lowStockAlert !== undefined && lowStockAlert !== existing.lowStockAlert) changes.lowStockAlert = { from: existing.lowStockAlert, to: lowStockAlert }
      if (image !== undefined && image !== existing.image) changes.image = { from: existing.image, to: image }

      const updateData: Record<string, unknown> = {}
      if (name !== undefined) updateData.name = name
      if (sku !== undefined) updateData.sku = sku || null
      if (hpp !== undefined) updateData.hpp = hpp
      if (price !== undefined) updateData.price = price
      if (bruto !== undefined) updateData.bruto = bruto
      if (netto !== undefined) updateData.netto = netto
      if (lowStockAlert !== undefined) updateData.lowStockAlert = lowStockAlert
      if (image !== undefined) updateData.image = image || null

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

    return NextResponse.json(product)
  } catch (error) {
    console.error('Product PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    )
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
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Create audit log before deleting
    await db.auditLog.create({
      data: {
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
      },
    })

    await db.product.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Product DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    )
  }
}
