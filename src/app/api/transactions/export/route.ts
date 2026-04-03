import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { getPlanFeatures } from '@/lib/plan-config'
import * as XLSX from 'xlsx'
import { safeJsonError } from '@/lib/safe-response'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return unauthorized()
    }
    const outletId = user.outletId

    // K1: Plan gating — only Pro/Enterprise can export Excel
    const outlet = await db.outlet.findUnique({
      where: { id: outletId },
      select: { accountType: true },
    })
    const accountType = outlet?.accountType?.startsWith('suspended:')
      ? outlet.accountType.replace('suspended:', '')
      : (outlet?.accountType || 'free')
    const features = getPlanFeatures(accountType)
    if (!features.exportExcel) {
      return safeJsonError('Fitur export Excel hanya tersedia untuk paket Pro ke atas. Upgrade sekarang!', 403)
    }

    const { searchParams } = request.nextUrl
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const cashierId = searchParams.get('cashierId') || ''
    const paymentMethod = searchParams.get('paymentMethod') || ''

    const where: Record<string, unknown> = { outletId }
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, unknown> = {}
      if (dateFrom) {
        const start = new Date(dateFrom)
        start.setHours(0, 0, 0, 0)
        dateFilter.gte = start
      }
      if (dateTo) {
        const end = new Date(dateTo)
        end.setHours(23, 59, 59, 999)
        dateFilter.lte = end
      }
      where.createdAt = dateFilter
    }
    if (cashierId) {
      where.userId = cashierId
    }
    if (paymentMethod) {
      where.paymentMethod = paymentMethod
    }

    const transactions = await db.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        invoiceNumber: true,
        subtotal: true,
        discount: true,
        total: true,
        paymentMethod: true,
        paidAmount: true,
        change: true,
        customer: {
          select: { name: true },
        },
        user: {
          select: { name: true },
        },
        items: {
          select: {
            productName: true,
            price: true,
            qty: true,
            subtotal: true,
          },
        },
        createdAt: true,
      },
    })

    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount)

    const formatDateCell = (date: Date) =>
      new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(date))

    // Check void status for each transaction
    const transactionIds = transactions.map((t) => t.id)
    const voidLogs = transactionIds.length > 0
      ? await db.auditLog.findMany({
          where: {
            entityType: 'TRANSACTION',
            entityId: { in: transactionIds },
            action: 'VOID',
            outletId,
          },
          select: { entityId: true, details: true },
        })
      : []

    const voidSet = new Set(voidLogs.map((l) => l.entityId))

    // Build export rows: one row per transaction
    const rows = transactions.map((t) => ({
      'Invoice #': t.invoiceNumber,
      'Tanggal': formatDateCell(t.createdAt),
      'Kasir': t.user?.name || '-',
      'Customer': t.customer?.name || 'Walk-in',
      'Metode Pembayaran': t.paymentMethod,
      'Subtotal': formatCurrency(t.subtotal),
      'Diskon': formatCurrency(t.discount),
      'Total': formatCurrency(t.total),
      'Dibayar': formatCurrency(t.paidAmount),
      'Kembalian': formatCurrency(t.change),
      'Items': t.items.map((i) => `${i.productName} (${i.qty}x)`).join(', '),
      'Status': voidSet.has(t.id) ? 'VOID' : 'Aktif',
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)

    // Auto-size columns
    const colWidths = Object.keys(rows[0] || {}).map((key) => ({
      wch: Math.max(
        key.length + 2,
        ...rows.map((r) => String(r[key as keyof typeof r] || '').length)
      ),
    }))
    worksheet['!cols'] = colWidths

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions')

    const dateRange = dateFrom && dateTo ? `${dateFrom}_to_${dateTo}` : 'all'
    const filename = `transactions_${dateRange}.xlsx`

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Transactions export error:', error)
    return safeJsonError('Failed to export transactions', 500)
  }
}
