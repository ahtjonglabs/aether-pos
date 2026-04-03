import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { db } from '@/lib/db'

/**
 * GET /api/settings/permissions/my
 *
 * Returns the current user's own crew permissions.
 * OWNER always gets all pages. CREW gets their specific permission record.
 * This endpoint is accessible to all authenticated users (not just OWNER).
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return unauthorized()

  try {
    // OWNER always has access to everything
    if (user.role === 'OWNER') {
      return NextResponse.json({
        role: 'OWNER',
        pages: 'dashboard,products,customers,pos,transactions,audit-log,crew,settings',
      })
    }

    // CREW: fetch their permission record
    const crewPerm = await db.crewPermission.findUnique({
      where: { userId: user.id },
    })

    return NextResponse.json({
      role: 'CREW',
      pages: crewPerm?.pages || 'pos',
    })
  } catch (error) {
    console.error('GET /api/settings/permissions/my error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
