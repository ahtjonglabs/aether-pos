import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { notifyNewCustomer } from '@/lib/notify'

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
    const search = searchParams.get('search') || ''

    const skip = (page - 1) * limit

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

    return NextResponse.json({
      customers,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Customers GET error:', error)
    return NextResponse.json(
      { error: 'Failed to load customers' },
      { status: 500 }
    )
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
      return NextResponse.json(
        { error: 'Name and WhatsApp number are required' },
        { status: 400 }
      )
    }

    // Check unique whatsapp
    const existing = await db.customer.findUnique({
      where: { whatsapp },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'WhatsApp number already registered' },
        { status: 400 }
      )
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

    // Fire-and-forget: Send Telegram notification
    notifyNewCustomer(outletId, { name, whatsapp })

    return NextResponse.json(customer, { status: 201 })
  } catch (error) {
    console.error('Customers POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create customer' },
      { status: 500 }
    )
  }
}
