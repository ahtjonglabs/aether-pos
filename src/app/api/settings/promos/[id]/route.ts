import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { db } from '@/lib/db'

// PUT /api/settings/promos/[id] — update promo
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request)
  if (!user) return unauthorized()

  // Only OWNER can manage promos
  if (user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Hanya pemilik yang dapat mengakses' }, { status: 403 })
  }

  try {
    const { id } = await params

    // Verify promo belongs to outlet
    const existing = await db.promo.findUnique({ where: { id } })
    if (!existing || existing.outletId !== user.outletId) {
      return NextResponse.json({ error: 'Promo tidak ditemukan' }, { status: 404 })
    }

    const body = await request.json()
    const { name, type, value, minPurchase, maxDiscount, active } = body

    // L4: Track changes for audit
    const changes: Record<string, { from: unknown; to: unknown }> = {}
    if (name !== undefined && name !== existing.name) changes.name = { from: existing.name, to: name }
    if (type !== undefined && type !== existing.type) changes.type = { from: existing.type, to: type }
    if (value !== undefined && Number(value) !== existing.value) changes.value = { from: existing.value, to: Number(value) }
    if (active !== undefined && active !== existing.active) changes.active = { from: existing.active, to: active }

    const promo = await db.$transaction(async (tx) => {
      const updated = await tx.promo.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(type !== undefined && { type }),
          ...(value !== undefined && { value: Number(value) }),
          ...(minPurchase !== undefined && { minPurchase: minPurchase ? Number(minPurchase) : null }),
          ...(maxDiscount !== undefined && { maxDiscount: maxDiscount ? Number(maxDiscount) : null }),
          ...(active !== undefined && { active }),
        },
      })

      if (Object.keys(changes).length > 0) {
        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'PROMO',
            entityId: id,
            details: JSON.stringify({ promoName: updated.name, changes }),
            outletId: user.outletId,
            userId: user.id,
          },
        })
      }

      return updated
    })

    return NextResponse.json(promo)
  } catch (error) {
    console.error('PUT /api/settings/promos/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/settings/promos/[id] — delete promo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request)
  if (!user) return unauthorized()

  // Only OWNER can manage promos
  if (user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Hanya pemilik yang dapat mengakses' }, { status: 403 })
  }

  try {
    const { id } = await params

    // Verify promo belongs to outlet
    const existing = await db.promo.findUnique({ where: { id } })
    if (!existing || existing.outletId !== user.outletId) {
      return NextResponse.json({ error: 'Promo tidak ditemukan' }, { status: 404 })
    }

    // L4: Audit log before delete
    await db.auditLog.create({
      data: {
        action: 'DELETE',
        entityType: 'PROMO',
        entityId: id,
        details: JSON.stringify({ promoName: existing.name, type: existing.type, value: existing.value }),
        outletId: user.outletId,
        userId: user.id,
      },
    })

    await db.promo.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/settings/promos/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
