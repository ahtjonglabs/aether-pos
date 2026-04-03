import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { db } from '@/lib/db'

// GET /api/settings/promos — list all promos
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return unauthorized()

  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') === 'true'

    const where: Record<string, unknown> = { outletId: user.outletId }
    if (activeOnly) where.active = true

    const promos = await db.promo.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ promos })
  } catch (error) {
    console.error('GET /api/settings/promos error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/settings/promos — create promo
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return unauthorized()

  // Only OWNER can manage promos
  if (user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Hanya pemilik yang dapat mengakses' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { name, type, value, minPurchase, maxDiscount, active } = body

    if (!name || !type || value === undefined) {
      return NextResponse.json(
        { error: 'Nama, tipe, dan nilai diskon wajib diisi' },
        { status: 400 }
      )
    }

    // L4: Create promo with audit log
    const promo = await db.$transaction(async (tx) => {
      const newPromo = await tx.promo.create({
        data: {
          name,
          type,
          value: Number(value),
          minPurchase: minPurchase ? Number(minPurchase) : null,
          maxDiscount: maxDiscount ? Number(maxDiscount) : null,
          active: active !== undefined ? active : true,
          outletId: user.outletId,
        },
      })

      await tx.auditLog.create({
        data: {
          action: 'CREATE',
          entityType: 'PROMO',
          entityId: newPromo.id,
          details: JSON.stringify({ promoName: newPromo.name, type: newPromo.type, value: newPromo.value }),
          outletId: user.outletId,
          userId: user.id,
        },
      })

      return newPromo
    })

    return NextResponse.json(promo, { status: 201 })
  } catch (error) {
    console.error('POST /api/settings/promos error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
