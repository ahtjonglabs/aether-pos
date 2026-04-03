import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { sendTelegramMessage } from '@/lib/telegram'

const TELEGRAM_API = 'https://api.telegram.org'

/**
 * POST /api/telegram/setup
 *
 * Accepts:
 * - { chatId } — link Telegram (legacy flow)
 * - { action: "test", botToken, chatId } — test connection with custom bot token
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

    // Test connection mode
    if (body.action === 'test') {
      const { botToken, chatId } = body as { botToken?: string; chatId?: string }

      if (!botToken || typeof botToken !== 'string') {
        return NextResponse.json(
          { error: 'Bot Token wajib diisi' },
          { status: 400 }
        )
      }

      // Step 1: Validate bot token by calling getMe
      let botInfo: { id: number; first_name: string; username?: string } | null = null
      try {
        const meRes = await fetch(`${TELEGRAM_API}/bot${botToken}/getMe`)
        const meData = await meRes.json() as { ok: boolean; result?: { id: number; first_name: string; username?: string }; description?: string }

        if (!meData.ok || !meData.result) {
          return NextResponse.json(
            { error: `Bot Token tidak valid: ${meData.description || 'Unknown error'}` },
            { status: 400 }
          )
        }
        botInfo = meData.result
      } catch (err) {
        return NextResponse.json(
          { error: `Gagal terhubung ke Telegram API: ${err instanceof Error ? err.message : 'Unknown error'}` },
          { status: 400 }
        )
      }

      // Step 2: If chatId provided, send test message
      if (chatId && typeof chatId === 'string') {
        const testText = `✅ <b>Telegram Notifikasi Terhubung!</b>\n\n🏪 Aether POS\n🤖 Bot: @${botInfo.username || botInfo.first_name}\n👋 Halo ${user.name}, notifikasi akan dikirim ke chat ini.\n\nKamu akan menerima:\n• Notifikasi transaksi baru\n• Notifikasi customer baru\n• Laporan harian & bulanan\n\n⚙️ Atur jenis notifikasi di halaman Pengaturan.`

        try {
          const sendRes = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: testText,
              parse_mode: 'HTML',
              disable_web_page_preview: true,
            }),
          })
          const sendData = await sendRes.json() as { ok: boolean; description?: string }

          if (!sendData.ok) {
            return NextResponse.json(
              { error: `Bot valid tapi gagal mengirim pesan ke Chat ID ${chatId}: ${sendData.description || 'Pastikan Chat ID benar dan bot telah di-start'}` },
              { status: 400 }
            )
          }
        } catch (err) {
          return NextResponse.json(
            { error: `Bot valid tapi gagal mengirim pesan: ${err instanceof Error ? err.message : 'Unknown error'}` },
            { status: 400 }
          )
        }
      }

      return NextResponse.json({
        success: true,
        message: chatId ? 'Koneksi berhasil! Pesan tes terkirim.' : 'Bot Token valid!',
        botInfo: {
          id: botInfo.id,
          name: botInfo.first_name,
          username: botInfo.username || null,
        },
      })
    }

    // Legacy flow: link chatId only
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
      data: { telegramChatId: null, telegramBotToken: null },
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
