import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { db } from '@/lib/db'

// GET /api/settings - fetch outlet settings + outlet info
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return unauthorized()

  try {
    let setting = await db.outletSetting.findUnique({
      where: { outletId: user.outletId },
      include: { outlet: true },
    })

    // Auto-create if not exists
    if (!setting) {
      setting = await db.outletSetting.create({
        data: { outletId: user.outletId },
        include: { outlet: true },
      })
    }

    return NextResponse.json({
      id: setting.id,
      outletId: setting.outletId,
      paymentMethods: setting.paymentMethods,
      loyaltyEnabled: setting.loyaltyEnabled,
      loyaltyPointsPerAmount: setting.loyaltyPointsPerAmount,
      loyaltyPointValue: setting.loyaltyPointValue,
      receiptBusinessName: setting.receiptBusinessName,
      receiptAddress: setting.receiptAddress,
      receiptPhone: setting.receiptPhone,
      receiptFooter: setting.receiptFooter,
      receiptLogo: setting.receiptLogo,
      themePrimaryColor: setting.themePrimaryColor,
      telegramChatId: setting.telegramChatId,
      notifyOnTransaction: setting.notifyOnTransaction,
      notifyOnCustomer: setting.notifyOnCustomer,
      notifyDailyReport: setting.notifyDailyReport,
      notifyWeeklyReport: setting.notifyWeeklyReport,
      notifyMonthlyReport: setting.notifyMonthlyReport,
      outlet: setting.outlet
        ? {
            id: setting.outlet.id,
            name: setting.outlet.name,
            address: setting.outlet.address,
            phone: setting.outlet.phone,
          }
        : null,
    })
  } catch (error) {
    console.error('GET /api/settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/settings — update outlet settings
export async function PUT(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return unauthorized()

  // Only OWNER can update outlet settings
  if (user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Hanya pemilik yang dapat mengakses' }, { status: 403 })
  }

  try {
    const body = await request.json()

    // Coerce types to match Prisma schema expectations
    const loyaltyEnabled = typeof body.loyaltyEnabled === 'boolean' ? body.loyaltyEnabled : undefined
    const loyaltyPointsPerAmount = body.loyaltyPointsPerAmount != null ? Number(body.loyaltyPointsPerAmount) : undefined
    const loyaltyPointValue = body.loyaltyPointValue != null ? Number(body.loyaltyPointValue) : undefined
    const notifyOnTransaction = typeof body.notifyOnTransaction === 'boolean' ? body.notifyOnTransaction : undefined
    const notifyOnCustomer = typeof body.notifyOnCustomer === 'boolean' ? body.notifyOnCustomer : undefined
    const notifyDailyReport = typeof body.notifyDailyReport === 'boolean' ? body.notifyDailyReport : undefined
    const notifyWeeklyReport = typeof body.notifyWeeklyReport === 'boolean' ? body.notifyWeeklyReport : undefined
    const notifyMonthlyReport = typeof body.notifyMonthlyReport === 'boolean' ? body.notifyMonthlyReport : undefined

    // Upsert settings
    const setting = await db.outletSetting.upsert({
      where: { outletId: user.outletId },
      create: {
        outletId: user.outletId,
        ...(body.paymentMethods !== undefined && { paymentMethods: String(body.paymentMethods) }),
        ...(loyaltyEnabled !== undefined && { loyaltyEnabled }),
        ...(loyaltyPointsPerAmount !== undefined && { loyaltyPointsPerAmount }),
        ...(loyaltyPointValue !== undefined && { loyaltyPointValue }),
        ...(body.receiptBusinessName !== undefined && { receiptBusinessName: String(body.receiptBusinessName ?? '') }),
        ...(body.receiptAddress !== undefined && { receiptAddress: String(body.receiptAddress ?? '') }),
        ...(body.receiptPhone !== undefined && { receiptPhone: String(body.receiptPhone ?? '') }),
        ...(body.receiptFooter !== undefined && { receiptFooter: String(body.receiptFooter ?? '') }),
        ...(body.receiptLogo !== undefined && { receiptLogo: String(body.receiptLogo ?? '') }),
        ...(body.themePrimaryColor !== undefined && { themePrimaryColor: String(body.themePrimaryColor) }),
        ...(body.telegramChatId !== undefined && { telegramChatId: body.telegramChatId ? String(body.telegramChatId) : null }),
        ...(notifyOnTransaction !== undefined && { notifyOnTransaction }),
        ...(notifyOnCustomer !== undefined && { notifyOnCustomer }),
        ...(notifyDailyReport !== undefined && { notifyDailyReport }),
        ...(notifyWeeklyReport !== undefined && { notifyWeeklyReport }),
        ...(notifyMonthlyReport !== undefined && { notifyMonthlyReport }),
      },
      update: {
        ...(body.paymentMethods !== undefined && { paymentMethods: String(body.paymentMethods) }),
        ...(loyaltyEnabled !== undefined && { loyaltyEnabled }),
        ...(loyaltyPointsPerAmount !== undefined && { loyaltyPointsPerAmount }),
        ...(loyaltyPointValue !== undefined && { loyaltyPointValue }),
        ...(body.receiptBusinessName !== undefined && { receiptBusinessName: String(body.receiptBusinessName ?? '') }),
        ...(body.receiptAddress !== undefined && { receiptAddress: String(body.receiptAddress ?? '') }),
        ...(body.receiptPhone !== undefined && { receiptPhone: String(body.receiptPhone ?? '') }),
        ...(body.receiptFooter !== undefined && { receiptFooter: String(body.receiptFooter ?? '') }),
        ...(body.receiptLogo !== undefined && { receiptLogo: String(body.receiptLogo ?? '') }),
        ...(body.themePrimaryColor !== undefined && { themePrimaryColor: String(body.themePrimaryColor) }),
        ...(body.telegramChatId !== undefined && { telegramChatId: body.telegramChatId ? String(body.telegramChatId) : null }),
        ...(notifyOnTransaction !== undefined && { notifyOnTransaction }),
        ...(notifyOnCustomer !== undefined && { notifyOnCustomer }),
        ...(notifyDailyReport !== undefined && { notifyDailyReport }),
        ...(notifyWeeklyReport !== undefined && { notifyWeeklyReport }),
        ...(notifyMonthlyReport !== undefined && { notifyMonthlyReport }),
      },
      include: { outlet: true },
    })

    // Update outlet info if provided
    if (body.outletName !== undefined || body.outletAddress !== undefined || body.outletPhone !== undefined) {
      await db.outlet.update({
        where: { id: user.outletId },
        data: {
          ...(body.outletName !== undefined && { name: body.outletName }),
          ...(body.outletAddress !== undefined && { address: body.outletAddress }),
          ...(body.outletPhone !== undefined && { phone: body.outletPhone }),
        },
      })

      // L5: Audit log for outlet info changes
      const outletChanges: Record<string, { from: unknown; to: unknown }> = {}
      if (body.outletName !== undefined) outletChanges.outletName = { from: setting.outlet?.name || '', to: body.outletName }
      if (body.outletAddress !== undefined) outletChanges.outletAddress = { from: setting.outlet?.address || '', to: body.outletAddress }
      if (body.outletPhone !== undefined) outletChanges.outletPhone = { from: setting.outlet?.phone || '', to: body.outletPhone }
      if (Object.keys(outletChanges).length > 0) {
        await db.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'OUTLET',
            entityId: user.outletId,
            details: JSON.stringify({ changes: outletChanges }),
            outletId: user.outletId,
            userId: user.id,
          },
        })
      }
    }

    // L5: Audit log for settings changes (excluding outlet info, handled above)
    const SETTINGS_KEYS = [
      'paymentMethods', 'loyaltyEnabled', 'loyaltyPointsPerAmount', 'loyaltyPointValue',
      'receiptBusinessName', 'receiptAddress', 'receiptPhone', 'receiptFooter', 'receiptLogo',
      'themePrimaryColor', 'telegramChatId',
      'notifyOnTransaction', 'notifyOnCustomer', 'notifyDailyReport', 'notifyWeeklyReport', 'notifyMonthlyReport',
    ] as const
    const settingsChanged: Record<string, unknown> = {}
    for (const key of SETTINGS_KEYS) {
      if (body[key] !== undefined) {
        settingsChanged[key] = body[key]
      }
    }
    if (Object.keys(settingsChanged).length > 0) {
      await db.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'SETTINGS',
          entityId: setting.id,
          details: JSON.stringify({ changes: settingsChanged }),
          outletId: user.outletId,
          userId: user.id,
        },
      })
    }

    // Re-fetch with updated outlet
    const updated = await db.outletSetting.findUnique({
      where: { outletId: user.outletId },
      include: { outlet: true },
    })

    return NextResponse.json({
      id: updated!.id,
      outletId: updated!.outletId,
      paymentMethods: updated!.paymentMethods,
      loyaltyEnabled: updated!.loyaltyEnabled,
      loyaltyPointsPerAmount: updated!.loyaltyPointsPerAmount,
      loyaltyPointValue: updated!.loyaltyPointValue,
      receiptBusinessName: updated!.receiptBusinessName,
      receiptAddress: updated!.receiptAddress,
      receiptPhone: updated!.receiptPhone,
      receiptFooter: updated!.receiptFooter,
      receiptLogo: updated!.receiptLogo,
      themePrimaryColor: updated!.themePrimaryColor,
      telegramChatId: updated!.telegramChatId,
      notifyOnTransaction: updated!.notifyOnTransaction,
      notifyOnCustomer: updated!.notifyOnCustomer,
      notifyDailyReport: updated!.notifyDailyReport,
      notifyWeeklyReport: updated!.notifyWeeklyReport,
      notifyMonthlyReport: updated!.notifyMonthlyReport,
      outlet: updated!.outlet
        ? {
            id: updated!.outlet.id,
            name: updated!.outlet.name,
            address: updated!.outlet.address,
            phone: updated!.outlet.phone,
          }
        : null,
    })
  } catch (error) {
    console.error('PUT /api/settings error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 })
  }
}
