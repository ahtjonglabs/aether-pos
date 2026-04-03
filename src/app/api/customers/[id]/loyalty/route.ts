import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'

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

    const customer = await db.customer.findFirst({
      where: { id, outletId },
    })
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const { searchParams } = request.nextUrl
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20))
    const skip = (page - 1) * limit

    const [loyaltyLogs, total] = await Promise.all([
      db.loyaltyLog.findMany({
        where: { customerId: id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.loyaltyLog.count({ where: { customerId: id } }),
    ])

    return NextResponse.json({ logs: loyaltyLogs, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('Loyalty GET error:', error)
    return NextResponse.json(
      { error: 'Failed to load loyalty history' },
      { status: 500 }
    )
  }
}
