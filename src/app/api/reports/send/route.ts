import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import {
  notifyDailyReport,
  notifyWeeklyReport,
  notifyMonthlyReport,
  notifyDailySummary,
} from '@/lib/notify'
import { db } from '@/lib/db'

/**
 * POST /api/reports/send
 *
 * Trigger report notifications to Telegram.
 * Can be called by OWNER from the app, or by cron job.
 *
 * Body: { type: "daily" | "weekly" | "monthly" | "summary", outletId?: string }
 *
 * Cron job usage (via /api/command or external scheduler):
 *   Daily summary at 22:00:  { type: "summary" }
 *   Weekly report on Monday: { type: "weekly" }
 *   Monthly report on 1st:   { type: "monthly" }
 */
export async function POST(request: NextRequest) {
  try {
    // H1: Parse body ONCE at the top to avoid double-consumption
    const body = await request.json().catch(() => ({}))
    const { type, outletId: bodyOutletId } = body as { type?: string; outletId?: string }

    if (!type || !['daily', 'weekly', 'monthly', 'summary'].includes(type)) {
      return NextResponse.json(
        { error: 'type harus salah satu: daily, weekly, monthly, summary' },
        { status: 400 }
      )
    }

    // Auth: check if it's an authenticated OWNER or a cron job with COMMAND_SECRET
    let outletId: string | null = null

    const authHeader = request.headers.get('authorization')
    const commandSecret = process.env.COMMAND_SECRET

    if (authHeader && commandSecret && authHeader === `Bearer ${commandSecret}`) {
      // Cron / Command Center call — outletId from body
      outletId = bodyOutletId || null
    } else {
      // Regular authenticated call
      const user = await getAuthUser(request)
      if (!user) return unauthorized()
      if (user.role !== 'OWNER') {
        return NextResponse.json(
          { error: 'Hanya pemilik yang dapat mengirim laporan' },
          { status: 403 }
        )
      }
      outletId = user.outletId
    }

    if (!outletId) {
      return NextResponse.json(
        { error: 'outletId diperlukan' },
        { status: 400 }
      )
    }

    let result: { sent: boolean; error?: string }

    switch (type) {
      case 'daily':
        result = await notifyDailyReport(outletId)
        break
      case 'weekly':
        result = await notifyWeeklyReport(outletId)
        break
      case 'monthly':
        result = await notifyMonthlyReport(outletId)
        break
      case 'summary':
        result = await notifyDailySummary(outletId)
        break
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    return NextResponse.json({
      success: result.sent,
      type,
      outletId,
      ...(result.error ? { error: result.error } : {}),
    })
  } catch (error) {
    console.error('[/api/reports/send] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/reports/send
 *
 * For cron jobs via Command Center (GET with Bearer token).
 * Query: ?type=daily|weekly|monthly|summary&outletId=xxx
 *
 * Also supports "broadcast" mode: if no outletId, sends to ALL outlets.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const commandSecret = process.env.COMMAND_SECRET

    if (!authHeader || !commandSecret || authHeader !== `Bearer ${commandSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized — COMMAND_SECRET required' },
        { status: 401 }
      )
    }

    const { searchParams } = request.nextUrl
    const type = searchParams.get('type') || 'summary'
    const targetOutletId = searchParams.get('outletId')

    if (!['daily', 'weekly', 'monthly', 'summary'].includes(type)) {
      return NextResponse.json(
        { error: 'type harus salah satu: daily, weekly, monthly, summary' },
        { status: 400 }
      )
    }

    // Get outlets to send to
    let outletIds: string[]
    if (targetOutletId) {
      outletIds = [targetOutletId]
    } else {
      // Broadcast to ALL outlets
      const outlets = await db.outlet.findMany({
        select: { id: true },
      })
      outletIds = outlets.map((o) => o.id)
    }

    const results: Array<{ outletId: string; sent: boolean; error?: string }> = []

    for (const oid of outletIds) {
      let result: { sent: boolean; error?: string }
      switch (type) {
        case 'daily':
          result = await notifyDailyReport(oid)
          break
        case 'weekly':
          result = await notifyWeeklyReport(oid)
          break
        case 'monthly':
          result = await notifyMonthlyReport(oid)
          break
        case 'summary':
          result = await notifyDailySummary(oid)
          break
        default:
          result = { sent: false, error: 'Invalid type' }
      }
      results.push({ outletId: oid, ...result })
    }

    return NextResponse.json({
      success: true,
      type,
      mode: targetOutletId ? 'single' : 'broadcast',
      totalOutlets: outletIds.length,
      sent: results.filter((r) => r.sent).length,
      failed: results.filter((r) => !r.sent).length,
      results,
    })
  } catch (error) {
    console.error('[/api/reports/send GET] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
