import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'

/**
 * DELETE /api/outlets/[id] — Delete an outlet branch (Enterprise only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) return unauthorized()

    if (user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Hanya pemilik yang dapat menghapus outlet' }, { status: 403 })
    }

    const { id } = await params

    // Cannot delete primary outlet
    if (id === user.outletId) {
      return NextResponse.json(
        { error: 'Outlet utama tidak dapat dihapus' },
        { status: 400 }
      )
    }

    // Verify outlet belongs to same owner (same email)
    const targetOwner = await db.user.findFirst({
      where: { email: user.email, outletId: id, role: 'OWNER' },
    })
    if (!targetOwner) {
      return NextResponse.json({ error: 'Outlet tidak ditemukan atau bukan milik Anda' }, { status: 404 })
    }

    // Delete in correct order (FK constraints)
    await db.loyaltyLog.deleteMany({ where: { transaction: { outlet: { outletId: id } } } })
    await db.transactionItem.deleteMany({ where: { transaction: { outletId: id } } })
    await db.transaction.deleteMany({ where: { outletId: id } })
    await db.auditLog.deleteMany({ where: { outletId: id } })
    await db.crewPermission.deleteMany({ where: { outletId: id } })
    await db.promo.deleteMany({ where: { outletId: id } })
    await db.customer.deleteMany({ where: { outletId: id } })
    await db.product.deleteMany({ where: { outletId: id } })
    await db.outletSetting.deleteMany({ where: { outletId: id } })
    await db.user.deleteMany({ where: { outletId: id } })
    await db.outlet.delete({ where: { id } })

    return NextResponse.json({ message: 'Outlet berhasil dihapus' })
  } catch (error) {
    console.error('[/api/outlets] DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
