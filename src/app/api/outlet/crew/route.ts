import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { getOutletPlan } from '@/lib/plan-config'

/**
 * GET /api/outlet/crew — List all crew (non-owner users) for the outlet
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return unauthorized()

    if (user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Hanya pemilik yang dapat mengakses' }, { status: 403 })
    }

    const crew = await db.user.findMany({
      where: {
        outletId: user.outletId,
        role: 'CREW',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        crewPermission: {
          select: { pages: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ crew })
  } catch (error) {
    console.error('[/api/outlet/crew] GET error:', error)
    return NextResponse.json({ error: 'Failed to load crew' }, { status: 500 })
  }
}

/**
 * POST /api/outlet/crew — Add a new crew member
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return unauthorized()

    if (user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Hanya pemilik yang dapat menambah crew' }, { status: 403 })
    }

    // Check plan limits
    const planData = await getOutletPlan(user.outletId, db)
    if (planData?.features.maxCrew !== -1) {
      const currentCount = await db.user.count({
        where: { outletId: user.outletId, role: 'CREW' },
      })
      if (currentCount >= planData.features.maxCrew) {
        return NextResponse.json(
          { error: `Batas crew (${planData.features.maxCrew}) sudah tercapai. Upgrade ke Pro untuk unlimited crew.` },
          { status: 403 }
        )
      }
    }

    const body = await request.json()
    const { name, email, password } = body

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Nama, email, dan password wajib diisi' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
    }

    // Check email uniqueness within outlet
    const existingUser = await db.user.findUnique({
      where: { email },
    })
    if (existingUser) {
      return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const newCrew = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'CREW',
        outletId: user.outletId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        action: 'CREATE',
        entityType: 'CREW',
        entityId: newCrew.id,
        details: JSON.stringify({ name, email }),
        outletId: user.outletId,
        userId: user.id,
      },
    })

    return NextResponse.json({ crew: newCrew }, { status: 201 })
  } catch (error) {
    console.error('[/api/outlet/crew] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
