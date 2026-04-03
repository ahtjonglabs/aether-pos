import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { db } from '@/lib/db'

/**
 * POST /api/auth/change-password
 *
 * Change the authenticated user's password.
 * Requires current password verification.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return unauthorized()

    const body = await request.json()
    const { currentPassword, newPassword } = body as { currentPassword?: string; newPassword?: string }

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Password saat ini dan password baru wajib diisi' },
        { status: 400 }
      )
    }

    // Validate new password length
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password baru minimal 6 karakter' },
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

    // Check new password is not same as current
    const isSamePassword = await bcrypt.compare(newPassword, dbUser.password)
    if (isSamePassword) {
      return NextResponse.json(
        { error: 'Password baru harus berbeda dari password saat ini' },
        { status: 400 }
      )
    }

    // Hash new password and update
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await db.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    })

    return NextResponse.json({
      success: true,
      message: 'Password berhasil diperbarui',
    })
  } catch (error) {
    console.error('[/api/auth/change-password] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
