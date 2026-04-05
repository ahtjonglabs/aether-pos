import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { sendTelegramMessage, formatStockAlertMessage, type StockAlertItem } from '@/lib/telegram'
import { safeJson, safeJsonError } from '@/lib/safe-response'

const TELEGRAM_API = 'https://api.telegram.org'

/**
 * POST /api/telegram/notify
 *
 * Send notifications to outlets via Telegram.
 * Used by cron jobs (no auth required — uses internal secret).
 *
 * Body:
 *   - type: "stock" | "daily" | "weekly" | "monthly"
 *   - outletId?: string (optional — if omitted, sends to ALL configured outlets)
 *   - secret: string (internal cron secret)
 */
export async function POST(request: NextRequest) {
  try {
    // Validate internal secret for cron access
    const body = await request.json()
    const { type, outletId, secret } = body as {
      type?: string
      outletId?: string
      secret?: string
    }

    // Simple secret check — prevents unauthorized calls
    const cronSecret = process.env.CRON_SECRET || 'aether-pos-cron-2024'
    if (secret !== cronSecret) {
      return safeJsonError('Unauthorized', 401)
    }

    if (!type) {
      return safeJsonError('Missing notification type', 400)
    }

    // Find all outlets with Telegram configured
    const whereClause: Record<string, unknown> = {
      telegramChatId: { not: null as unknown },
    }
    if (outletId) {
      whereClause.outletId = outletId
    }

    const configuredSettings = await db.outletSetting.findMany({
      where: whereClause,
      include: {
        outlet: {
          select: { id: true, name: true },
        },
      },
    })

    if (configuredSettings.length === 0) {
      console.log('[telegram/notify] No outlets with Telegram configured')
      return safeJson({ success: true, sent: 0, message: 'No outlets configured' })
    }

    let sentCount = 0
    let errorCount = 0
    const results: Array<{ outletId: string; outletName: string; ok: boolean; error?: string }> = []

    for (const setting of configuredSettings) {
      const chatId = setting.telegramBotToken
        ? undefined // will use custom bot token
        : setting.telegramChatId!

      const botToken = setting.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN

      if (!botToken || !setting.telegramChatId) {
        results.push({ outletId: setting.outletId, outletName: setting.outlet.name, ok: false, error: 'No bot token or chat ID' })
        errorCount++
        continue
      }

      try {
        if (type === 'stock') {
          const sendResult = await sendStockAlert(setting.outletId, setting.outlet.name, setting.telegramChatId, botToken)
          if (sendResult.ok) {
            sentCount++
            results.push({ outletId: setting.outletId, outletName: setting.outlet.name, ok: true })
          } else {
            errorCount++
            results.push({ outletId: setting.outletId, outletName: setting.outlet.name, ok: false, error: sendResult.error })
          }
        } else {
          results.push({ outletId: setting.outletId, outletName: setting.outlet.name, ok: false, error: `Unknown type: ${type}` })
          errorCount++
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        console.error(`[telegram/notify] Error for outlet ${setting.outletId}:`, msg)
        results.push({ outletId: setting.outletId, outletName: setting.outlet.name, ok: false, error: msg })
        errorCount++
      }
    }

    return safeJson({
      success: errorCount === 0,
      sent: sentCount,
      errors: errorCount,
      results,
    })
  } catch (error) {
    console.error('[telegram/notify] Error:', error)
    return safeJsonError('Internal server error')
  }
}

// ============================================================
// Stock Alert Handler
// ============================================================

async function sendStockAlert(
  outletId: string,
  outletName: string,
  chatId: string,
  botToken?: string
): Promise<{ ok: boolean; error?: string }> {
  // 1. Get low-stock and out-of-stock products
  const products = await db.product.findMany({
    where: {
      outletId,
      OR: [
        { stock: { lte: 0 } },
        { AND: [{ stock: { gt: 0 } }, { stock: { lte: 1000 } }] }, // broad filter, we refine in code
      ],
    },
    select: {
      id: true,
      name: true,
      stock: true,
      lowStockAlert: true,
      unit: true,
      price: true,
      category: { select: { name: true } },
    },
    orderBy: { stock: 'asc' },
  })

  // Filter: only items that are actually low stock or out of stock
  const alertItems: StockAlertItem[] = products
    .filter((p) => p.stock <= p.lowStockAlert)
    .map((p) => ({
      name: p.name,
      stock: p.stock,
      lowStockAlert: p.lowStockAlert,
      unit: p.unit,
      price: p.price,
      categoryName: p.category?.name,
    }))

  // 2. Calculate sales velocity for forecasting (last 14 days)
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  // Get product sales quantities in the last 14 days
  const salesData = await db.transactionItem.groupBy({
    by: ['productId'],
    where: {
      transaction: {
        outletId,
        createdAt: { gte: fourteenDaysAgo },
      },
      productId: { not: null },
    },
    _sum: { qty: true },
  })

  // Build a map: productId -> total qty sold in 14 days
  const salesMap = new Map<string, number>()
  for (const row of salesData) {
    if (row.productId && row._sum.qty) {
      salesMap.set(row.productId, row._sum.qty)
    }
  }

  // Build product ID map from the products query
  const productMap = new Map<string, number>()
  for (const p of products) {
    productMap.set(p.id, p.stock)
  }

  // Calculate days until empty for each alert item
  for (const item of alertItems) {
    // Find matching product by name to get ID
    const matchingProduct = products.find((p) => p.name === item.name)
    if (!matchingProduct || item.stock <= 0) {
      item.daysUntilEmpty = 0 // already empty
      continue
    }

    const sold14d = salesMap.get(matchingProduct.id) || 0
    const dailyVelocity = sold14d / 14

    if (dailyVelocity > 0) {
      item.daysUntilEmpty = Math.floor(item.stock / dailyVelocity)
    } else {
      item.daysUntilEmpty = null // no recent sales data
    }
  }

  // 3. If no items need attention, skip
  if (alertItems.length === 0) {
    console.log(`[telegram/notify] Outlet ${outletName}: All stock OK, skipping alert`)
    return { ok: true }
  }

  // 4. Format and send
  const message = formatStockAlertMessage({
    outletName,
    items: alertItems,
  })

  // Use custom bot token if outlet has one, otherwise use global token
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return { ok: false, error: 'No bot token available' }
  }

  const url = `${TELEGRAM_API}/bot${token}/sendMessage`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })

  const data = await res.json() as { ok: boolean; description?: string }
  if (!data.ok) {
    console.error(`[telegram/notify] Send failed for ${outletName}: ${data.description}`)
    return { ok: false, error: data.description }
  }

  console.log(`[telegram/notify] Stock alert sent to ${outletName} (${alertItems.length} items)`)
  return { ok: true }
}
