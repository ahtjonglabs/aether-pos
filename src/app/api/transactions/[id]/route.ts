import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { safeJson, safeJsonError } from '@/lib/safe-response'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return unauthorized()
    }
    const outletId = user.outletId

    const { id } = await params

    const transaction = await db.transaction.findFirst({
      where: { id, outletId },
      include: {
        items: true,
        customer: {
          select: { id: true, name: true, whatsapp: true },
        },
        user: {
          select: { id: true, name: true },
        },
      },
    })

    if (!transaction) {
      return safeJsonError('Transaction not found', 404)
    }

    // Check void status
    const voidLog = await db.auditLog.findFirst({
      where: {
        entityType: 'TRANSACTION',
        entityId: id,
        action: 'VOID',
        outletId,
      },
    })

    let voidInfo: { reason: string; voidedBy: string; voidedAt: string } | null = null
    if (voidLog) {
      try {
        const details = JSON.parse(voidLog.details || '{}')
        voidInfo = {
          reason: details.reason || '',
          voidedBy: details.voidedBy || '',
          voidedAt: details.voidedAt || '',
        }
      } catch {
        voidInfo = { reason: '', voidedBy: '', voidedAt: '' }
      }
    }

    // Get outlet info for receipt
    const outlet = await db.outlet.findUnique({
      where: { id: outletId },
      select: { name: true, address: true, phone: true },
    })

    return safeJson({
      ...transaction,
      voidStatus: voidInfo ? 'void' : 'active',
      voidInfo,
      syncStatus: 'synced' as const,
      outlet: outlet || { name: 'Aether POS', address: '', phone: '' },
    })
  } catch (error) {
    console.error('Transaction detail GET error:', error)
    return safeJsonError('Failed to load transaction detail', 500)
  }
}
