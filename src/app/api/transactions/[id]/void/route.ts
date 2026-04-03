import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { safeAuditLog } from '@/lib/safe-audit'
import { safeJson, safeJsonError } from '@/lib/safe-response'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return unauthorized()
    }
    if (user.role !== 'OWNER') {
      return safeJsonError('Only OWNER can void transactions', 403)
    }

    const outletId = user.outletId
    const userId = user.id
    const { id } = await params

    // Verify transaction belongs to this outlet
    const transaction = await db.transaction.findFirst({
      where: { id, outletId },
    })
    if (!transaction) {
      return safeJsonError('Transaction not found', 404)
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
      return safeJsonError('Transaction already voided', 400)
    }

    const body = await request.json()
    const { reason } = body as { reason?: string }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return safeJsonError('Reason is required for void', 400)
    }

    // Create void audit log
    await safeAuditLog({
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
    })

    return safeJson({ success: true, message: 'Transaction voided' })
  } catch (error) {
    console.error('Void transaction error:', error)
    return safeJsonError('Failed to void transaction', 500)
  }
}
