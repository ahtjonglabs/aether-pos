import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'

/**
 * PUT /api/outlet/crew/[id] — Update crew member info
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) return unauthorized()

    if (user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Hanya pemilik yang dapat mengubah data crew' }, { status: 403 })
    }

    const { id } = await params

    // Verify crew exists and belongs to same outlet
    const crew = await db.user.findUnique({
      where: { id },
    })
    if (!crew || crew.outletId !== user.outletId || crew.role !== 'CREW') {
      return NextResponse.json({ error: 'Crew tidak ditemukan' }, { status: 404 })
    }

    const body = await request.json()
    const { name, email, password } = body

    // Build update data
    const updateData: Record<string, string> = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) {
      // Check email uniqueness (excluding current crew)
      if (email !== crew.email) {
        const existingUser = await db.user.findUnique({ where: { email } })
        if (existingUser) {
          return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 409 })
        }
        updateData.email = email
      }
    }

    if (password !== undefined) {
      if (password.length < 6) {
        return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
      }
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10)
        updateData.password = hashedPassword
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Tidak ada data yang diubah' }, { status: 400 })
    }

    const updatedCrew = await db.user.update({
      where: { id },
      data: updateData,
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
        action: 'UPDATE',
        entityType: 'CREW',
        entityId: id,
        details: JSON.stringify({ changes: Object.keys(updateData) }),
        outletId: user.outletId,
        userId: user.id,
      },
    })

    return NextResponse.json({ crew: updatedCrew })
  } catch (error) {
    console.error('[/api/outlet/crew/[id]] PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/outlet/crew/[id] — Delete a crew member
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) return unauthorized()

    if (user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Hanya pemilik yang dapat menghapus crew' }, { status: 403 })
    }

    const { id } = await params

    // Verify crew exists and belongs to same outlet
    const crew = await db.user.findUnique({
      where: { id },
    })
    if (!crew || crew.outletId !== user.outletId || crew.role !== 'CREW') {
      return NextResponse.json({ error: 'Crew tidak ditemukan' }, { status: 404 })
    }

    // Delete crew permission first (foreign key)
    await db.crewPermission.deleteMany({ where: { userId: id } })

    // Delete crew
    await db.user.delete({ where: { id } })

    // Audit log
    await db.auditLog.create({
      data: {
        action: 'DELETE',
        entityType: 'CREW',
        entityId: id,
        details: JSON.stringify({ name: crew.name, email: crew.email }),
        outletId: user.outletId,
        userId: user.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[/api/outlet/crew/[id]] DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
