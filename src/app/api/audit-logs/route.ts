import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { safeJson, safeJsonError } from '@/lib/safe-response'

const PAGE_SIZE = 20

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return unauthorized()
    }
    const outletId = user.outletId

    const { searchParams } = request.nextUrl
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || PAGE_SIZE))
    const action = searchParams.get('action') || ''
    const dateFrom = searchParams.get('from') || ''
    const dateTo = searchParams.get('to') || ''
    const search = searchParams.get('search') || ''

    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { outletId }

    if (action && action !== 'ALL') {
      where.action = action
    }
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) {
        (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom)
      }
      if (dateTo) {
        // Set to end of day
        const toDate = new Date(dateTo)
        toDate.setHours(23, 59, 59, 999)
        (where.createdAt as Record<string, unknown>).lte = toDate
      }
    }
    if (search) {
      where.OR = [
        { details: { contains: search } },
        { user: { name: { contains: search } } },
        { entityType: { contains: search } },
        { action: { contains: search } },
      ]
    }

    const [data, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: { name: true, email: true },
          },
        },
      }),
      db.auditLog.count({ where }),
    ])

    const logs = data.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      details: log.details,
      createdAt: log.createdAt,
      user: {
        name: log.user.name,
        email: log.user.email,
      },
    }))

    return safeJson({
      logs,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Audit logs GET error:', error)
    return safeJsonError('Failed to load audit logs')
  }
}
