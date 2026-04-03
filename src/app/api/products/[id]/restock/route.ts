import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return unauthorized()
    }
    const userId = user.id
    const outletId = user.outletId

    const { id } = await params
    const body = await request.json()
    const { quantity } = body

    if (!quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be greater than 0' },
        { status: 400 }
      )
    }

    const existing = await db.product.findFirst({
      where: { id, outletId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const product = await db.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: { stock: { increment: quantity } },
      })

      await tx.auditLog.create({
        data: {
          action: 'RESTOCK',
          entityType: 'PRODUCT',
          entityId: id,
          details: JSON.stringify({
            productName: updated.name,
            quantityAdded: quantity,
            previousStock: existing.stock,
            newStock: updated.stock,
          }),
          outletId,
          userId,
        },
      })

      return updated
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error('Restock POST error:', error)
    return NextResponse.json(
      { error: 'Failed to restock product' },
      { status: 500 }
    )
  }
}
