import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) return unauthorized()
    if (user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Only OWNER can void transactions' }, { status: 403 })
    }

    const outletId = user.outletId
    const userId = user.id
    const { id } = await params

    // Verify transaction belongs to this outlet
    const transaction = await db.transaction.findFirst({
      where: { id, outletId },
    })
    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Check if already voided
    const existingVoid = await db.auditLog.findFirst({
      where: {
        entityType: 'TRANSACTION',
        entityId: id,
        action: 'VOID',
        outletId,
      },
    })
    if (existingVoid) {
      return NextResponse.json({ error: 'Transaction already voided' }, { status: 400 })
    }

    const body = await request.json()
    const { reason } = body as { reason?: string }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json({ error: 'Reason is required for void' }, { status: 400 })
    }

    // Create void audit log
    await db.auditLog.create({
      data: {
        action: 'VOID',
        entityType: 'TRANSACTION',
        entityId: id,
        details: JSON.stringify({
          invoiceNumber: transaction.invoiceNumber,
          total: transaction.total,
          reason: reason.trim(),
          voidedBy: user.name || user.email,
          voidedAt: new Date().toISOString(),
        }),
        outletId,
        userId,
      },
    })

    return NextResponse.json({ success: true, message: 'Transaction voided' })
  } catch (error) {
    console.error('Void transaction error:', error)
    return NextResponse.json({ error: 'Failed to void transaction' }, { status: 500 })
  }
}
