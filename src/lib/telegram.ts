/**
 * telegram.ts — Telegram Bot API Service
 *
 * Sends formatted messages to outlet owners via Telegram.
 * Uses the Bot API directly (no webhook) — fire-and-forget pattern.
 *
 * Env: TELEGRAM_BOT_TOKEN (from @BotFather)
 */

const TELEGRAM_API = 'https://api.telegram.org'

// ============================================================
// Core Send Function
// ============================================================

interface SendResult {
  ok: boolean
  messageId?: number
  error?: string
}

/**
 * Send a message via Telegram Bot API.
 * Returns success/failure — never throws (fire-and-forget).
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  options?: {
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'
    disableNotification?: boolean
    replyMarkup?: Record<string, unknown>
  }
): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN

  if (!token) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN not set — skipping notification')
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' }
  }

  if (!chatId) {
    return { ok: false, error: 'No chatId provided' }
  }

  try {
    const url = `${TELEGRAM_API}/bot${token}/sendMessage`

    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: options?.parseMode || 'HTML',
      disable_web_page_preview: true,
    }

    if (options?.disableNotification) {
      body.disable_notification = true
    }
    if (options?.replyMarkup) {
      body.reply_markup = options.replyMarkup
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json() as { ok: boolean; result?: { message_id: number }; description?: string }

    if (!data.ok) {
      console.error(`[telegram] API error: ${data.description}`)
      return { ok: false, error: data.description }
    }

    return { ok: true, messageId: data.result?.message_id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[telegram] Send failed: ${msg}`)
    return { ok: false, error: msg }
  }
}

// ============================================================
// Helpers
// ============================================================

/** Format currency as IDR */
function formatRp(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

/** Format date as Indonesian locale */
function formatDateID(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Format time */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ============================================================
// Message Formatters
// ============================================================

export interface TransactionNotifyData {
  invoiceNumber: string
  items: Array<{ productName: string; qty: number; price: number; subtotal: number }>
  subtotal: number
  discount: number
  total: number
  paymentMethod: string
  paidAmount: number
  change: number
  customerName?: string
  cashierName: string
  outletName: string
}

/**
 * Format new transaction notification
 */
export function formatTransactionMessage(data: TransactionNotifyData): string {
  const now = new Date()
  const itemLines = data.items
    .map(
      (item) =>
        `  • ${item.productName} × ${item.qty} = ${formatRp(item.subtotal)}`
    )
    .join('\n')

  return [
    `🛒 <b>Transaksi Baru</b>`,
    `📦 <code>${data.invoiceNumber}</code>`,
    `🕐 ${formatDateID(now)} • ${formatTime(now)}`,
    ``,
    `<b>Item:</b>`,
    itemLines,
    ``,
    `💰 Subtotal: ${formatRp(data.subtotal)}`,
    data.discount > 0
      ? `🏷️ Diskon: -${formatRp(data.discount)}`
      : null,
    `✅ <b>Total: ${formatRp(data.total)}</b>`,
    `💳 ${data.paymentMethod} ${data.paidAmount > 0 ? `• Bayar: ${formatRp(data.paidAmount)} • Kembali: ${formatRp(data.change)}` : ''}`,
    data.customerName ? `👤 Customer: ${data.customerName}` : null,
    `🧑‍💼 Kasir: ${data.cashierName}`,
    `🏪 ${data.outletName}`,
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Format new customer notification
 */
export function formatCustomerMessage(data: {
  name: string
  whatsapp: string
  outletName: string
}): string {
  const now = new Date()
  return [
    `👤 <b>Customer Baru</b>`,
    `🕐 ${formatDateID(now)} • ${formatTime(now)}`,
    ``,
    `📛 Nama: <b>${data.name}</b>`,
    `📱 WhatsApp: <code>${data.whatsapp}</code>`,
    `🏪 ${data.outletName}`,
  ].join('\n')
}

export interface RevenueData {
  brutto: number       // Total sales (subtotal)
  discount: number     // Total discounts given
  netto: number        // Actual revenue (total paid)
  transactionCount: number
  averageTransaction: number
  topProduct?: string  // Best seller name
  topProductQty?: number
}

/**
 * Format daily revenue report
 */
export function formatDailyReportMessage(data: RevenueData & {
  outletName: string
  date: Date
}): string {
  return [
    `📊 <b>Laporan Harian</b>`,
    `📅 ${formatDateID(data.date)}`,
    `🏪 ${data.outletName}`,
    ``,
    `💰 <b>Brutto:</b> ${formatRp(data.brutto)}`,
    `🏷️ <b>Diskon:</b> -${formatRp(data.discount)}`,
    `✅ <b>Netto:</b> <b>${formatRp(data.netto)}</b>`,
    ``,
    `🧾 Transaksi: ${data.transactionCount}`,
    `📈 Rata-rata: ${formatRp(data.averageTransaction)}`,
    data.topProduct
      ? `🏆 Terlaris: ${data.topProduct} (${data.topProductQty}x)`
      : null,
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Format weekly report
 */
export function formatWeeklyReportMessage(data: {
  outletName: string
  weekStart: Date
  weekEnd: Date
  days: Array<{
    date: string
    brutto: number
    netto: number
    count: number
  }>
  totals: RevenueData
}): string {
  const dayLines = data.days
    .map(
      (d) =>
        `  ${d.date}: ${formatRp(d.netto)} (${d.count} trx)`
    )
    .join('\n')

  // Find best & worst day
  const bestDay = [...data.days].sort((a, b) => b.netto - a.netto)[0]
  const worstDay = [...data.days].sort((a, b) => a.netto - b.netto)[0]

  return [
    `📈 <b>Laporan Mingguan</b>`,
    `📅 ${formatDateID(data.weekStart)} — ${formatDateID(data.weekEnd)}`,
    `🏪 ${data.outletName}`,
    ``,
    `📊 <b>Ringkasan 7 Hari:</b>`,
    dayLines,
    ``,
    `💰 <b>Total Brutto:</b> ${formatRp(data.totals.brutto)}`,
    `🏷️ <b>Total Diskon:</b> -${formatRp(data.totals.discount)}`,
    `✅ <b>Total Netto:</b> <b>${formatRp(data.totals.netto)}</b>`,
    `🧾 Total Transaksi: ${data.totals.transactionCount}`,
    `📈 Rata-rata/Hari: ${formatRp(data.totals.netto / Math.max(1, data.days.length))}`,
    ``,
    `🟢 Hari Terbaik: ${bestDay?.date || '-'} (${formatRp(bestDay?.netto || 0)})`,
    `🔴 Hari Terendah: ${worstDay?.date || '-'} (${formatRp(worstDay?.netto || 0)})`,
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Format monthly report
 */
export function formatMonthlyReportMessage(data: {
  outletName: string
  month: number  // 0-11
  year: number
  totalNetto: number
  totalBrutto: number
  totalDiscount: number
  transactionCount: number
  newCustomers: number
  topProducts: Array<{ name: string; qty: number; revenue: number }>
}): string {
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ]
  const monthName = monthNames[data.month]

  const productLines = data.topProducts
    .slice(0, 5)
    .map(
      (p, i) =>
        `  ${i + 1}. ${p.name} — ${p.qty}x = ${formatRp(p.revenue)}`
    )
    .join('\n')

  return [
    `📊 <b>Laporan Bulanan</b>`,
    `📅 ${monthName} ${data.year}`,
    `🏪 ${data.outletName}`,
    ``,
    `💰 <b>Total Brutto:</b> ${formatRp(data.totalBrutto)}`,
    `🏷️ <b>Total Diskon:</b> -${formatRp(data.totalDiscount)}`,
    `✅ <b>Total Netto:</b> <b>${formatRp(data.totalNetto)}</b>`,
    `🧾 Total Transaksi: ${data.transactionCount}`,
    `📈 Rata-rata/Trx: ${formatRp(data.totalNetto / Math.max(1, data.transactionCount))}`,
    `👤 Customer Baru: ${data.newCustomers}`,
    ``,
    data.topProducts.length > 0
      ? `🏆 <b>Top 5 Produk:</b>\n${productLines}`
      : null,
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Quick daily summary (sent at end of day with just the key numbers)
 */
export function formatDailySummaryMessage(data: RevenueData & {
  outletName: string
  newCustomers: number
  lowStockCount: number
}): string {
  return [
    `🌙 <b>Ringkasan Hari Ini</b>`,
    `📅 ${formatDateID(new Date())}`,
    `🏪 ${data.outletName}`,
    ``,
    `💰 Netto: <b>${formatRp(data.netto)}</b>`,
    `🧾 ${data.transactionCount} transaksi`,
    `👤 ${data.newCustomers} customer baru`,
    data.lowStockCount > 0
      ? `⚠️ ${data.lowStockCount} produk stok rendah`
      : `✅ Semua stok aman`,
  ].join('\n')
}
