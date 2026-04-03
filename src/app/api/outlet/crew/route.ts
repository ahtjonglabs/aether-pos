import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'

/**
 * GET /api/outlet/crew
 *
 * Returns list of crew (non-owner users) for the current outlet.
 * Used by transactions page for cashier filter.
 */
export async function GET() {
  try {
    const user = await getAuthUser()
    if (!user) return unauthorized()

    const crew = await db.user.findMany({
      where: {
        outletId: user.outletId,
        role: { not: 'OWNER' },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ crew })
  } catch (error) {
    console.error('[/api/outlet/crew] Error:', error)
    return NextResponse.json({ error: 'Failed to load crew' }, { status: 500 })
  }
}
