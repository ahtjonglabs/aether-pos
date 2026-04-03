import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { parsePagination } from '@/lib/api-helpers'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { notifyNewCustomer } from '@/lib/notify'
import { safeJson, safeJsonCreated, safeJsonError } from '@/lib/safe-response'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return unauthorized()
    }
    const outletId = user.outletId

    const { searchParams } = request.nextUrl
    const { skip, limit } = parsePagination(searchParams)
    const search = searchParams.get('search') || ''

    const where: Record<string, unknown> = { outletId }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { whatsapp: { contains: search } },
      ]
    }

    const [customers, total] = await Promise.all([
      db.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.customer.count({ where }),
    ])

    return safeJson({
      customers,
      totalPages: Math.ceil(total / limit) || 1,
    })
  } catch (error) {
    console.error('Customers GET error:', error)
    return safeJsonError('Failed to load customers', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return unauthorized()
    }
    const outletId = user.outletId

    const body = await request.json()
    const { name, whatsapp } = body

    if (!name || !whatsapp) {
      return safeJsonError('Name and WhatsApp number are required', 400)
    }

    // Check unique whatsapp per outlet
    const existing = await db.customer.findFirst({
      where: { whatsapp, outletId },
    })
    if (existing) {
      return safeJsonError('WhatsApp number already registered in this outlet', 400)
    }

    const customer = await db.$transaction(async (tx) => {
      const newCustomer = await tx.customer.create({
        data: {
          name,
          whatsapp,
          outletId,
        },
      })

      // L3: Audit log for customer creation
      await tx.auditLog.create({
        data: {
          action: 'CREATE',
          entityType: 'CUSTOMER',
          entityId: newCustomer.id,
          details: JSON.stringify({
            customerName: newCustomer.name,
            whatsapp: newCustomer.whatsapp,
          }),
          outletId,
          userId: user.id,
        },
      })

      return newCustomer
    })

    // Prepare response first
    const response = safeJsonCreated(customer)

    // Fire-and-forget: Send Telegram notification (don't await — best-effort)
    void notifyNewCustomer(outletId, { name, whatsapp })

    return response
  } catch (error) {
    console.error('Customers POST error:', error)
    return safeJsonError('Failed to create customer', 500)
  }
}
