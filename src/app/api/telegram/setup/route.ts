import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { sendTelegramMessage } from '@/lib/telegram'

/**
 * POST /api/telegram/setup
 *
 * Step 1: Owner sends /start to the Aether POS bot on Telegram.
 * Step 2: Owner copies their chat_id from the bot's response.
 * Step 3: Owner calls this API with { chatId } to link their Telegram.
 * Step 4: A test message is sent to confirm.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return unauthorized()

    if (user.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Hanya pemilik yang dapat mengatur notifikasi' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { chatId } = body as { chatId?: string }

    if (!chatId || typeof chatId !== 'string') {
      return NextResponse.json(
        { error: 'chatId wajib diisi (string)' },
        { status: 400 }
      )
    }

    // Validate by sending a test message
    const testResult = await sendTelegramMessage(
      chatId,
      `✅ <b>Telegram Notifikasi Terhubung!</b>\n\n🏪 Aether POS\n👋 Halo ${user.name}, notifikasi akan dikirim ke chat ini.\n\nKamu akan menerima:\n• Notifikasi transaksi baru\n• Notifikasi customer baru\n• Laporan harian & bulanan\n\n⚙️ Atur jenis notifikasi di halaman Pengaturan.`
    )

    if (!testResult.ok) {
      return NextResponse.json(
        { error: `Gagal mengirim test message: ${testResult.error}` },
        { status: 400 }
      )
    }

    // Save chatId to outlet settings
    await db.outletSetting.upsert({
      where: { outletId: user.outletId },
      create: { outletId: user.outletId, telegramChatId: chatId },
      update: { telegramChatId: chatId },
    })

    return NextResponse.json({
      success: true,
      message: 'Telegram berhasil terhubung',
      chatId,
      testMessageId: testResult.messageId,
    })
  } catch (error) {
    console.error('[/api/telegram/setup] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/telegram/setup
 *
 * Unlink Telegram notifications.
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return unauthorized()

    if (user.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Hanya pemilik yang dapat mengatur notifikasi' },
        { status: 403 }
      )
    }

    await db.outletSetting.update({
      where: { outletId: user.outletId },
      data: { telegramChatId: null },
    })

    return NextResponse.json({
      success: true,
      message: 'Telegram notifikasi terputus',
    })
  } catch (error) {
    console.error('[/api/telegram/setup] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
