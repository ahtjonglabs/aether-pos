import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { db } from '@/lib/db'

/**
 * POST /api/auth/change-email
 *
 * Change the authenticated user's email address.
 * Requires current password verification for security.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return unauthorized()

    const body = await request.json()
    const { email, currentPassword } = body as { email?: string; currentPassword?: string }

    if (!email || !currentPassword) {
      return NextResponse.json(
        { error: 'Email dan password saat ini wajib diisi' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Format email tidak valid' },
        { status: 400 }
      )
    }

    // Fetch user with password
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, dbUser.password)
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Password saat ini salah' },
        { status: 401 }
      )
    }

    // Check if email is same as current
    if (dbUser.email === email) {
      return NextResponse.json(
        { error: 'Email baru harus berbeda dari email saat ini' },
        { status: 400 }
      )
    }

    // Check email uniqueness within outlet
    const existingEmail = await db.user.findFirst({
      where: {
        email,
        outletId: user.outletId,
        id: { not: user.id },
      },
    })

    if (existingEmail) {
      return NextResponse.json(
        { error: 'Email sudah digunakan oleh user lain di outlet ini' },
        { status: 409 }
      )
    }

    // Update email
    await db.user.update({
      where: { id: user.id },
      data: { email },
    })

    return NextResponse.json({
      success: true,
      message: 'Email berhasil diperbarui',
      newEmail: email,
    })
  } catch (error) {
    console.error('[/api/auth/change-email] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
