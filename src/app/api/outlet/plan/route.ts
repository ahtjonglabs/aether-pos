import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-utils'
import { db } from '@/lib/db'
import { getPlanFeatures, getPlanLabel } from '@/lib/plan-config'

/**
 * GET /api/outlet/plan
 *
 * Returns the current outlet's plan info + full feature matrix.
 * Called by the client on mount and periodically to detect
 * plan changes from the Command Center.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    const outlet = await db.outlet.findUnique({
      where: { id: user.outletId },
      select: {
        id: true,
        name: true,
        accountType: true,
        updatedAt: true,
        setting: {
          select: {
            loyaltyEnabled: true,
            loyaltyPointsPerAmount: true,
            loyaltyPointValue: true,
          },
        },
        _count: {
          select: {
            users: true,
            products: true,
            customers: true,
            promos: true,
            transactions: true,
          },
        },
      },
    })

    if (!outlet) {
      return NextResponse.json({ error: 'Outlet not found' }, { status: 404 })
    }

    // Derive active status from accountType
    const isSuspended = outlet.accountType.startsWith('suspended:')
    const rawPlan = isSuspended
      ? outlet.accountType.replace('suspended:', '')
      : outlet.accountType

    const features = getPlanFeatures(rawPlan)

    // Calculate usage vs limits
    const usage = {
      products: outlet._count.products,
      customers: outlet._count.customers,
      crew: outlet._count.users - 1, // exclude owner
      promos: outlet._count.promos,
      transactions: outlet._count.transactions,
    }

    return NextResponse.json({
      outletId: outlet.id,
      outletName: outlet.name,
      plan: {
        type: rawPlan,
        label: getPlanLabel(rawPlan),
        isSuspended,
      },
      features,
      usage,
      lastUpdated: outlet.updatedAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[/api/outlet/plan] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
