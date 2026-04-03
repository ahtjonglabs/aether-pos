import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { db } from '@/lib/db'

// PUT /api/settings/permissions/[userId] — update crew permissions
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const user = await getAuthUser(request)
  if (!user) return unauthorized()

  // Only OWNER can manage permissions
  if (user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Hanya pemilik yang dapat mengakses' }, { status: 403 })
  }

  try {
    const { userId } = await params

    // Verify crew belongs to same outlet
    const crew = await db.user.findUnique({
      where: { id: userId },
    })
    if (!crew || crew.outletId !== user.outletId || crew.role !== 'CREW') {
      return NextResponse.json({ error: 'Crew tidak ditemukan' }, { status: 404 })
    }

    const body = await request.json()
    const { pages } = body

    if (!pages || typeof pages !== 'string') {
      return NextResponse.json({ error: 'Pages wajib diisi' }, { status: 400 })
    }

    // Upsert crew permission
    const permission = await db.crewPermission.upsert({
      where: { userId },
      create: {
        userId,
        pages,
        outletId: user.outletId,
      },
      update: {
        pages,
      },
    })

    return NextResponse.json({
      userId: permission.userId,
      pages: permission.pages,
    })
  } catch (error) {
    console.error('PUT /api/settings/permissions/[userId] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
