/**
 * notify.ts — Notification Dispatcher
 *
 * Fire-and-forget notification system.
 * Checks outlet settings (telegramChatId, notify toggles)
 * before sending. Never blocks the main request.
 *
 * Usage:
 *   import { notifyNewTransaction } from '@/lib/notify'
 *   await notifyNewTransaction(outletId, { ... })
 */

import { db } from '@/lib/db'
import {
  sendTelegramMessage,
  formatTransactionMessage,
  formatCustomerMessage,
  formatDailyReportMessage,
  formatWeeklyReportMessage,
  formatMonthlyReportMessage,
  formatDailySummaryMessage,
  type TransactionNotifyData,
  type RevenueData,
} from '@/lib/telegram'

// ============================================================
// Internal: Get outlet's Telegram config
// ============================================================

interface TelegramConfig {
  chatId: string | null
  notifyOnTransaction: boolean
  notifyOnCustomer: boolean
  notifyDailyReport: boolean
  notifyWeeklyReport: boolean
  notifyMonthlyReport: boolean
  outletName: string
}

async function getTelegramConfig(outletId: string): Promise<TelegramConfig | null> {
  try {
    const setting = await db.outletSetting.findUnique({
      where: { outletId },
      select: {
        telegramChatId: true,
        notifyOnTransaction: true,
        notifyOnCustomer: true,
        notifyDailyReport: true,
        notifyWeeklyReport: true,
        notifyMonthlyReport: true,
        outlet: { select: { name: true } },
      },
    })

    if (!setting || !setting.telegramChatId) return null

    return {
      chatId: setting.telegramChatId,
      notifyOnTransaction: setting.notifyOnTransaction,
      notifyOnCustomer: setting.notifyOnCustomer,
      notifyDailyReport: setting.notifyDailyReport,
      notifyWeeklyReport: setting.notifyWeeklyReport,
      notifyMonthlyReport: setting.notifyMonthlyReport,
      outletName: setting.outlet?.name || 'Outlet',
    }
  } catch {
    return null
  }
}

// ============================================================
// Public Notification Functions
// ============================================================

/**
 * Notify owner about a new transaction.
 * Call this AFTER the transaction is committed.
 */
export async function notifyNewTransaction(
  outletId: string,
  data: TransactionNotifyData
): Promise<void> {
  // Fire-and-forget — don't await in critical path
  getTelegramConfig(outletId).then((config) => {
    if (!config?.chatId || !config.notifyOnTransaction) return

    const message = formatTransactionMessage({
      ...data,
      outletName: config.outletName,
    })

    sendTelegramMessage(config.chatId, message).then((result) => {
      if (result.ok) {
        console.log(`[notify] Transaction sent to Telegram chat ${config.chatId}`)
      }
    })
  })
}

/**
 * Notify owner about a new customer registration.
 */
export async function notifyNewCustomer(
  outletId: string,
  data: { name: string; whatsapp: string }
): Promise<void> {
  getTelegramConfig(outletId).then((config) => {
    if (!config?.chatId || !config.notifyOnCustomer) return

    const message = formatCustomerMessage({
      ...data,
      outletName: config.outletName,
    })

    sendTelegramMessage(config.chatId, message).catch(() => {})
  })
}

/**
 * Send daily revenue report to owner.
 * Can be called manually or via cron job.
 */
export async function notifyDailyReport(
  outletId: string
): Promise<{ sent: boolean; error?: string }> {
  const config = await getTelegramConfig(outletId)
  if (!config?.chatId || !config.notifyDailyReport) {
    return { sent: false, error: 'Telegram not configured or daily report disabled' }
  }

  const today = new Date()
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

  // Fetch today's transaction data
  const transactions = await db.transaction.findMany({
    where: {
      outletId,
      createdAt: { gte: startOfDay, lt: endOfDay },
    },
    select: {
      subtotal: true,
      discount: true,
      total: true,
      items: { select: { productName: true, qty: true } },
    },
  })

  // Calculate revenue
  let brutto = 0
  let discount = 0
  let netto = 0
  const productMap = new Map<string, number>()

  for (const txn of transactions) {
    brutto += txn.subtotal
    discount += txn.discount
    netto += txn.total

    for (const item of txn.items) {
      productMap.set(
        item.productName,
        (productMap.get(item.productName) || 0) + item.qty
      )
    }
  }

  // Find top product
  let topProduct: string | undefined
  let topProductQty = 0
  for (const [name, qty] of productMap) {
    if (qty > topProductQty) {
      topProduct = name
      topProductQty = qty
    }
  }

  const revenueData: RevenueData = {
    brutto,
    discount,
    netto,
    transactionCount: transactions.length,
    averageTransaction: transactions.length > 0 ? netto / transactions.length : 0,
    topProduct,
    topProductQty,
  }

  const message = formatDailyReportMessage({
    ...revenueData,
    outletName: config.outletName,
    date: today,
  })

  const result = await sendTelegramMessage(config.chatId, message)
  return { sent: result.ok, error: result.error }
}

/**
 * Send weekly report to owner.
 */
export async function notifyWeeklyReport(
  outletId: string
): Promise<{ sent: boolean; error?: string }> {
  const config = await getTelegramConfig(outletId)
  if (!config?.chatId || !config.notifyWeeklyReport) {
    return { sent: false, error: 'Telegram not configured or weekly report disabled' }
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Get Monday of current week
  const dayOfWeek = today.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() + mondayOffset)
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)

  // Fetch transactions for the week
  const transactions = await db.transaction.findMany({
    where: {
      outletId,
      createdAt: { gte: weekStart, lt: weekEnd },
    },
    select: {
      subtotal: true,
      discount: true,
      total: true,
      createdAt: true,
      items: { select: { productName: true, qty: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Group by day
  const dayMap = new Map<string, { brutto: number; netto: number; count: number }>()
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

  let totalBrutto = 0
  let totalDiscount = 0
  let totalNetto = 0

  for (const txn of transactions) {
    totalBrutto += txn.subtotal
    totalDiscount += txn.discount
    totalNetto += txn.total

    const dayKey = txn.createdAt.toLocaleDateString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
    const existing = dayMap.get(dayKey) || { brutto: 0, netto: 0, count: 0 }
    existing.brutto += txn.subtotal
    existing.netto += txn.total
    existing.count++
    dayMap.set(dayKey, existing)
  }

  // Fill all 7 days (even if no transactions)
  const days: Array<{ date: string; brutto: number; netto: number; count: number }> = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    const key = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
    const data = dayMap.get(key) || { brutto: 0, netto: 0, count: 0 }
    days.push({ date: `${dayNames[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`, ...data })
  }

  const message = formatWeeklyReportMessage({
    outletName: config.outletName,
    weekStart,
    weekEnd: new Date(weekEnd.getTime() - 1),
    days,
    totals: {
      brutto: totalBrutto,
      discount: totalDiscount,
      netto: totalNetto,
      transactionCount: transactions.length,
      averageTransaction: transactions.length > 0 ? totalNetto / transactions.length : 0,
    },
  })

  const result = await sendTelegramMessage(config.chatId, message)
  return { sent: result.ok, error: result.error }
}

/**
 * Send monthly report to owner.
 */
export async function notifyMonthlyReport(
  outletId: string,
  month?: number,  // 0-11, default: last month
  year?: number
): Promise<{ sent: boolean; error?: string }> {
  const config = await getTelegramConfig(outletId)
  if (!config?.chatId || !config.notifyMonthlyReport) {
    return { sent: false, error: 'Telegram not configured or monthly report disabled' }
  }

  const now = new Date()
  const reportMonth = month ?? now.getMonth() - 1  // Default: last month
  const reportYear = year ?? now.getFullYear()

  // Handle January → December of previous year
  const actualMonth = reportMonth < 0 ? 11 : reportMonth
  const actualYear = reportMonth < 0 ? reportYear - 1 : reportYear

  const startDate = new Date(actualYear, actualMonth, 1)
  const endDate = new Date(actualYear, actualMonth + 1, 1)

  // Fetch transactions
  const transactions = await db.transaction.findMany({
    where: {
      outletId,
      createdAt: { gte: startDate, lt: endDate },
    },
    select: {
      subtotal: true,
      discount: true,
      total: true,
      items: { select: { productName: true, qty: true, price: true } },
    },
  })

  // Aggregate
  let totalBrutto = 0
  let totalDiscount = 0
  let totalNetto = 0
  const productMap = new Map<string, { qty: number; revenue: number }>()

  for (const txn of transactions) {
    totalBrutto += txn.subtotal
    totalDiscount += txn.discount
    totalNetto += txn.total

    for (const item of txn.items) {
      const existing = productMap.get(item.productName) || { qty: 0, revenue: 0 }
      existing.qty += item.qty
      existing.revenue += item.price * item.qty
      productMap.set(item.productName, existing)
    }
  }

  // Top 5 products
  const topProducts = [...productMap.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([name, data]) => ({ name, ...data }))

  // New customers this month
  const newCustomers = await db.customer.count({
    where: {
      outletId,
      createdAt: { gte: startDate, lt: endDate },
    },
  })

  const message = formatMonthlyReportMessage({
    outletName: config.outletName,
    month: actualMonth,
    year: actualYear,
    totalNetto,
    totalBrutto,
    totalDiscount,
    transactionCount: transactions.length,
    newCustomers,
    topProducts,
  })

  const result = await sendTelegramMessage(config.chatId, message)
  return { sent: result.ok, error: result.error }
}

/**
 * Send daily summary (end-of-day quick numbers).
 * Includes low stock alert.
 */
export async function notifyDailySummary(
  outletId: string
): Promise<{ sent: boolean; error?: string }> {
  const config = await getTelegramConfig(outletId)
  if (!config?.chatId || !config.notifyDailyReport) {
    return { sent: false, error: 'Telegram not configured or daily report disabled' }
  }

  const today = new Date()
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const [transactions, newCustomersCount, lowStockCount] = await Promise.all([
    db.transaction.findMany({
      where: { outletId, createdAt: { gte: startOfDay } },
      select: { subtotal: true, discount: true, total: true, items: { select: { productName: true, qty: true } } },
    }),
    db.customer.count({
      where: { outletId, createdAt: { gte: startOfDay } },
    }),
    db.product.count({
      where: { outletId },
    }).then(async (total) => {
      const products = await db.product.findMany({
        where: { outletId },
        select: { stock: true, lowStockAlert: true },
      })
      return products.filter((p) => p.stock <= p.lowStockAlert).length
    }),
  ])

  let brutto = 0
  let discount = 0
  let netto = 0
  for (const txn of transactions) {
    brutto += txn.subtotal
    discount += txn.discount
    netto += txn.total
  }

  const message = formatDailySummaryMessage({
    brutto,
    discount,
    netto,
    transactionCount: transactions.length,
    averageTransaction: transactions.length > 0 ? netto / transactions.length : 0,
    outletName: config.outletName,
    newCustomers: newCustomersCount,
    lowStockCount,
  })

  const result = await sendTelegramMessage(config.chatId, message)
  return { sent: result.ok, error: result.error }
}
