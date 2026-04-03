'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { formatCurrency, formatDate } from '@/lib/format'
import { usePlan } from '@/hooks/use-plan'
import { ProGate } from '@/components/shared/pro-gate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagination } from '@/components/shared/pagination'
import {
  Search,
  Eye,
  Banknote,
  QrCode,
  CreditCard,
  CalendarDays,
  Download,
  RotateCcw,
  CheckCircle2,
  Clock,
  Ban,
  Printer,
  Lock,
  Filter,
  Loader2,
  Store,
  TrendingUp,
  Receipt,
  BarChart3,
  Trophy,
} from 'lucide-react'

interface TransactionItem {
  id: string
  productName: string
  price: number
  qty: number
  subtotal: number
}

interface Transaction {
  id: string
  invoiceNumber: string
  createdAt: string
  customerName?: string | null
  cashierName?: string | null
  cashierId?: string | null
  outletName?: string | null
  paymentMethod: string
  total: number
  _count?: { items: number }
  items?: TransactionItem[]
  voidStatus: 'active' | 'void'
  voidReason?: string | null
  syncStatus: 'synced' | 'pending'
  subtotal?: number
  discount?: number
  paidAmount?: number
  change?: number
}

interface TransactionListResponse {
  transactions: Transaction[]
  totalPages: number
}

interface CashierOption {
  id: string
  name: string
}

interface SummaryData {
  totalRevenue: number
  totalTransactions: number
  avgTransaction: number
  paymentBreakdown: { method: string; count: number; total: number }[]
  topProducts: { rank: number; name: string; quantity: number; revenue: number }[]
}

function getTodayISO(): string {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

export default function TransactionsPage() {
  const { data: session } = useSession()
  const isOwner = session?.user?.role === 'OWNER'
  const { plan } = usePlan()
  const isPro = plan?.type === 'pro' || plan?.type === 'enterprise'

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState(getTodayISO)
  const [dateTo, setDateTo] = useState(getTodayISO)
  const [cashierId, setCashierId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [voidFilter, setVoidFilter] = useState('')
  const [outletId, setOutletId] = useState('')

  // Cashier list
  const [cashiers, setCashiers] = useState<CashierOption[]>([])

  // Summary data
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailTransaction, setDetailTransaction] = useState<Transaction | null>(null)
  const [detailItems, setDetailItems] = useState<TransactionItem[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailOutlet, setDetailOutlet] = useState<{ name: string; address: string; phone: string } | null>(null)
  const [detailCashierName, setDetailCashierName] = useState<string | null>(null)
  const [detailVoidInfo, setDetailVoidInfo] = useState<{ reason: string; voidedBy: string; voidedAt: string } | null>(null)

  // Void dialog
  const [voidOpen, setVoidOpen] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [voidSubmitting, setVoidSubmitting] = useState(false)

  const receiptRef = useRef<HTMLDivElement>(null)

  // Fetch cashiers
  const fetchCashiers = useCallback(async () => {
    try {
      const res = await fetch('/api/outlet/crew')
      if (res.ok) {
        const data = await res.json()
        setCashiers(data.crew || [])
      }
    } catch {
      // Silently fail
    }
  }, [])

  // Fallback: fetch cashiers from users if crew endpoint doesn't exist
  const fetchCashiersFallback = useCallback(async () => {
    try {
      const res = await fetch('/api/transactions?limit=1')
      if (!res.ok) return
      const data = await res.json()
      // Extract unique cashiers from transactions
      const uniqueCashiers = new Map<string, string>()
      if (data.transactions) {
        for (const t of data.transactions) {
          if (t.cashierId && t.cashierName) {
            uniqueCashiers.set(t.cashierId, t.cashierName)
          }
        }
      }
      if (uniqueCashiers.size > 0) {
        setCashiers(Array.from(uniqueCashiers.entries()).map(([id, name]) => ({ id, name })))
      }
    } catch {
      // Silently fail
    }
  }, [])

  useEffect(() => {
    fetchCashiers().catch(() => fetchCashiersFallback())
  }, [fetchCashiers, fetchCashiersFallback])

  // Fetch transaction summary (Pro/Enterprise only)
  const fetchSummary = useCallback(async () => {
    if (!isPro) return
    if (!dateFrom && !dateTo) return

    setSummaryLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      if (outletId) params.set('outletId', outletId)

      const res = await fetch(`/api/transactions/summary?${params}`)
      if (res.ok) {
        const data = await res.json()
        setSummary(data)
      } else if (res.status === 403) {
        setSummary(null)
      }
    } catch {
      // Silently fail
    } finally {
      setSummaryLoading(false)
    }
  }, [dateFrom, dateTo, outletId, isPro])

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      if (cashierId) params.set('cashierId', cashierId)
      if (paymentMethod) params.set('paymentMethod', paymentMethod)
      if (voidFilter) params.set('voidStatus', voidFilter)
      const res = await fetch(`/api/transactions?${params}`)
      if (res.ok) {
        const data: TransactionListResponse = await res.json()
        setTransactions(data.transactions)
        setTotalPages(data.totalPages)

        // Update cashier list from response
        const uniqueCashiers = new Map<string, string>()
        for (const t of data.transactions) {
          if (t.cashierId && t.cashierName && !uniqueCashiers.has(t.cashierId)) {
            uniqueCashiers.set(t.cashierId, t.cashierName)
          }
        }
        if (uniqueCashiers.size > 0 && cashiers.length === 0) {
          setCashiers(Array.from(uniqueCashiers.entries()).map(([id, name]) => ({ id, name })))
        }
      } else {
        toast.error('Failed to load transactions')
      }
    } catch {
      toast.error('Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }, [page, search, dateFrom, dateTo, cashierId, paymentMethod, voidFilter, cashiers.length])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  // Fetch summary when date range changes
  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [dateFrom, dateTo, search, cashierId, paymentMethod, voidFilter, outletId])

  const handleViewDetail = async (transaction: Transaction) => {
    setDetailTransaction(transaction)
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailVoidInfo(null)
    setDetailOutlet(null)
    setDetailCashierName(null)
    try {
      const res = await fetch(`/api/transactions/${transaction.id}`)
      if (res.ok) {
        const data = await res.json()
        setDetailItems(data.items || [])
        setDetailVoidInfo(data.voidInfo || null)
        setDetailOutlet(data.outlet || null)
        setDetailCashierName(data.user?.name || null)
      }
    } catch {
      toast.error('Failed to load transaction detail')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleSetToday = () => {
    const today = getTodayISO()
    setDateFrom(today)
    setDateTo(today)
  }

  const handleClearDates = () => {
    setDateFrom('')
    setDateTo('')
  }

  const handleClearAllFilters = () => {
    setDateFrom(getTodayISO)
    setDateTo(getTodayISO)
    setSearch('')
    setCashierId('')
    setPaymentMethod('')
    setVoidFilter('')
    setOutletId('')
  }

  const handleExport = () => {
    if (!isPro) {
      toast.error('Fitur export hanya tersedia untuk akun Pro')
      return
    }
    const params = new URLSearchParams()
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    if (cashierId) params.set('cashierId', cashierId)
    if (paymentMethod) params.set('paymentMethod', paymentMethod)
    window.open(`/api/transactions/export?${params}`, '_blank')
  }

  const handleVoid = async () => {
    if (!detailTransaction || !voidReason.trim()) return
    setVoidSubmitting(true)
    try {
      const res = await fetch(`/api/transactions/${detailTransaction.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason.trim() }),
      })
      if (res.ok) {
        toast.success('Transaksi berhasil di-void')
        setVoidOpen(false)
        setVoidReason('')
        setDetailVoidInfo({
          reason: voidReason.trim(),
          voidedBy: session?.user?.name || '',
          voidedAt: new Date().toISOString(),
        })
        fetchTransactions()
        fetchSummary()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Gagal void transaksi')
      }
    } catch {
      toast.error('Gagal void transaksi')
    } finally {
      setVoidSubmitting(false)
    }
  }

  const handlePrint = () => {
    if (!receiptRef.current) return
    const content = receiptRef.current.innerHTML
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>Receipt - ${detailTransaction?.invoiceNumber || ''}</title>
          <style>
            body { font-family: 'Courier New', monospace; margin: 0; padding: 20px; font-size: 12px; }
            .receipt { max-width: 300px; margin: 0 auto; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .center { text-align: center; }
            .right { text-align: right; }
            table { width: 100%; border-collapse: collapse; }
            td { padding: 2px 0; }
          </style>
        </head>
        <body>
          <div class="receipt">${content}</div>
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `)
    win.document.close()
  }

  const hasActiveFilters = search || dateFrom || dateTo || cashierId || paymentMethod || voidFilter || outletId

  const getPaymentBadge = (method: string) => {
    switch (method) {
      case 'CASH':
        return (
          <Badge className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-[10px]">
            <Banknote className="mr-0.5 h-2.5 w-2.5" />CASH
          </Badge>
        )
      case 'QRIS':
        return (
          <Badge className="bg-amber-500/10 border-amber-500/20 text-amber-400 text-[10px]">
            <QrCode className="mr-0.5 h-2.5 w-2.5" />QRIS
          </Badge>
        )
      case 'DEBIT':
        return (
          <Badge className="bg-sky-500/10 border-sky-500/20 text-sky-400 text-[10px]">
            <CreditCard className="mr-0.5 h-2.5 w-2.5" />DEBIT
          </Badge>
        )
      default:
        return <Badge className="text-[10px]">{method}</Badge>
    }
  }

  const getPaymentBadgeSmall = (method: string, total: number, count: number) => {
    switch (method) {
      case 'CASH':
        return (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 px-3 py-2">
            <Banknote className="h-4 w-4 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-emerald-400">CASH</p>
              <p className="text-[10px] text-zinc-500">{count} transaksi</p>
            </div>
            <p className="text-xs font-semibold text-zinc-200 ml-auto whitespace-nowrap">{formatCurrency(total)}</p>
          </div>
        )
      case 'QRIS':
        return (
          <div className="flex items-center gap-2 rounded-lg bg-amber-500/5 border border-amber-500/10 px-3 py-2">
            <QrCode className="h-4 w-4 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-amber-400">QRIS</p>
              <p className="text-[10px] text-zinc-500">{count} transaksi</p>
            </div>
            <p className="text-xs font-semibold text-zinc-200 ml-auto whitespace-nowrap">{formatCurrency(total)}</p>
          </div>
        )
      case 'DEBIT':
        return (
          <div className="flex items-center gap-2 rounded-lg bg-sky-500/5 border border-sky-500/10 px-3 py-2">
            <CreditCard className="h-4 w-4 text-sky-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-sky-400">DEBIT</p>
              <p className="text-[10px] text-zinc-500">{count} transaksi</p>
            </div>
            <p className="text-xs font-semibold text-zinc-200 ml-auto whitespace-nowrap">{formatCurrency(total)}</p>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Transaksi</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Lihat semua transaksi penjualan</p>
      </div>

      {/* Transaction Summary Section (Pro/Enterprise only) */}
      <ProGate
        feature="transactionSummary"
        label="Ringkasan Transaksi"
        description="Lihat ringkasan penjualan per outlet"
        minHeight="180px"
      >
        {summaryLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 bg-zinc-900 rounded-lg" />
            ))}
          </div>
        ) : summary ? (
          <div className="space-y-3">
            {/* Summary Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Total Revenue */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-emerald-400" />
                    </div>
                    <span className="text-[11px] text-zinc-500 font-medium">Total Pendapatan</span>
                  </div>
                  <p className="text-lg font-bold text-zinc-100">{formatCurrency(summary.totalRevenue)}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    {dateFrom && dateTo && dateFrom === dateTo
                      ? `Hari ini`
                      : `${dateFrom || '...'} — ${dateTo || '...'}`
                    }
                  </p>
                </CardContent>
              </Card>

              {/* Total Transactions */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                      <Receipt className="h-4 w-4 text-sky-400" />
                    </div>
                    <span className="text-[11px] text-zinc-500 font-medium">Total Transaksi</span>
                  </div>
                  <p className="text-lg font-bold text-zinc-100">{summary.totalTransactions}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Non-void</p>
                </CardContent>
              </Card>

              {/* Average Transaction */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                      <BarChart3 className="h-4 w-4 text-violet-400" />
                    </div>
                    <span className="text-[11px] text-zinc-500 font-medium">Rata-rata Transaksi</span>
                  </div>
                  <p className="text-lg font-bold text-zinc-100">{formatCurrency(summary.avgTransaction)}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Per transaksi</p>
                </CardContent>
              </Card>

              {/* Payment Breakdown + Top Products */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Trophy className="h-4 w-4 text-amber-400" />
                    </div>
                    <span className="text-[11px] text-zinc-500 font-medium">Produk Terlaris</span>
                  </div>
                  {summary.topProducts.length > 0 ? (
                    <div className="space-y-0.5">
                      {summary.topProducts.slice(0, 2).map((p) => (
                        <div key={p.rank} className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-amber-400 w-4">#{p.rank}</span>
                            <span className="text-xs text-zinc-300 truncate max-w-[80px]">{p.name}</span>
                          </div>
                          <span className="text-[10px] text-zinc-500">{p.quantity}x</span>
                        </div>
                      ))}
                      {summary.topProducts.length > 2 && (
                        <p className="text-[10px] text-zinc-600">+{summary.topProducts.length - 2} lainnya</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-zinc-500">Belum ada data</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Payment Breakdown Row */}
            {summary.paymentBreakdown.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {summary.paymentBreakdown.map((pb) => (
                  <div key={pb.method} className="flex-1 min-w-[160px]">
                    {getPaymentBadgeSmall(pb.method, pb.total, pb.count)}
                  </div>
                ))}
              </div>
            )}

            {/* Top Products Full List */}
            {summary.topProducts.length > 0 && (
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-zinc-400 mb-3">Produk Terlaris</p>
                  <div className="space-y-2">
                    {summary.topProducts.map((p) => (
                      <div key={p.rank} className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          p.rank === 1
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : p.rank === 2
                              ? 'bg-zinc-400/10 text-zinc-400 border border-zinc-400/20'
                              : p.rank === 3
                                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                        }`}>
                          {p.rank}
                        </span>
                        <span className="text-xs text-zinc-300 flex-1 truncate">{p.name}</span>
                        <span className="text-[10px] text-zinc-500 shrink-0">{p.quantity} terjual</span>
                        <span className="text-xs font-medium text-zinc-200 shrink-0">{formatCurrency(p.revenue)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                      <BarChart3 className="h-4 w-4 text-zinc-600" />
                    </div>
                    <span className="text-[11px] text-zinc-600 font-medium">—</span>
                  </div>
                  <p className="text-lg font-bold text-zinc-700">Rp 0</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ProGate>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <Input
              placeholder="Cari invoice..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 sm:h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 w-full sm:w-[180px]"
            />
          </div>

          {/* Date filters */}
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 sm:h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-100 w-full sm:w-[130px] [color-scheme:dark]"
            />
            <span className="text-zinc-500 text-[11px] hidden sm:inline">—</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 sm:h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-100 w-full sm:w-[130px] [color-scheme:dark]"
            />
          </div>

          {/* Outlet filter (prepared for multi-outlet) */}
          <Select value={outletId || '__all__'} onValueChange={(v) => setOutletId(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-[150px] h-9 sm:h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-100">
              <Store className="mr-1.5 h-3 w-3 text-zinc-500" />
              <SelectValue placeholder="Outlet" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              <SelectItem value="__all__" className="text-zinc-200 focus:bg-zinc-700 text-xs">Semua Outlet</SelectItem>
              <SelectItem value="current" className="text-zinc-200 focus:bg-zinc-700 text-xs">Outlet Saat Ini</SelectItem>
            </SelectContent>
          </Select>

          {/* Cashier filter */}
          {isPro && cashiers.length > 0 && (
            <Select value={cashierId || '__all__'} onValueChange={(v) => setCashierId(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-full sm:w-[140px] h-9 sm:h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-100">
                <Filter className="mr-1.5 h-3 w-3 text-zinc-500" />
                <SelectValue placeholder="Kasir" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                <SelectItem value="__all__" className="text-zinc-200 focus:bg-zinc-700 text-xs">Semua Kasir</SelectItem>
                {cashiers.filter((c) => c.id).map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-zinc-200 focus:bg-zinc-700 text-xs">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Payment method filter */}
          {isPro && (
            <Select value={paymentMethod || '__all__'} onValueChange={(v) => setPaymentMethod(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-full sm:w-[140px] h-9 sm:h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-100">
                <Filter className="mr-1.5 h-3 w-3 text-zinc-500" />
                <SelectValue placeholder="Pembayaran" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                <SelectItem value="__all__" className="text-zinc-200 focus:bg-zinc-700 text-xs">Semua Metode</SelectItem>
                <SelectItem value="CASH" className="text-zinc-200 focus:bg-zinc-700 text-xs">CASH</SelectItem>
                <SelectItem value="QRIS" className="text-zinc-200 focus:bg-zinc-700 text-xs">QRIS</SelectItem>
                <SelectItem value="DEBIT" className="text-zinc-200 focus:bg-zinc-700 text-xs">DEBIT</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Void status filter */}
          <Select value={voidFilter || '__all__'} onValueChange={(v) => setVoidFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-[120px] h-9 sm:h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-100">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              <SelectItem value="__all__" className="text-zinc-200 focus:bg-zinc-700 text-xs">Semua</SelectItem>
              <SelectItem value="active" className="text-zinc-200 focus:bg-zinc-700 text-xs">Aktif</SelectItem>
              <SelectItem value="void" className="text-zinc-200 focus:bg-zinc-700 text-xs">Void</SelectItem>
            </SelectContent>
          </Select>

          {/* Quick actions */}
          <div className="flex gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSetToday}
              className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 text-[11px] h-8 px-2"
            >
              Hari Ini
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              onClick={handleClearAllFilters}
              title="Reset semua filter"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Export */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={!isPro}
          className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 h-8 text-xs"
        >
          {isPro ? (
            <>
              <Download className="mr-1.5 h-3 w-3" />
              Export
            </>
          ) : (
            <>
              <Lock className="mr-1.5 h-3 w-3" />
              Export
              <Badge className="ml-1.5 bg-violet-500/10 border-violet-500/20 text-violet-400 text-[10px] px-1 py-0">
                PRO
              </Badge>
            </>
          )}
        </Button>
      </div>

      {/* Active filter badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5">
          {search && (
            <Badge variant="outline" className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[11px] cursor-pointer" onClick={() => setSearch('')}>
              Search: {search} <span className="ml-1 text-zinc-500">×</span>
            </Badge>
          )}
          {dateFrom && (
            <Badge variant="outline" className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[11px] cursor-pointer" onClick={() => setDateFrom('')}>
              Dari: {dateFrom} <span className="ml-1 text-zinc-500">×</span>
            </Badge>
          )}
          {dateTo && (
            <Badge variant="outline" className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[11px] cursor-pointer" onClick={() => setDateTo('')}>
              Sampai: {dateTo} <span className="ml-1 text-zinc-500">×</span>
            </Badge>
          )}
          {outletId && (
            <Badge variant="outline" className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[11px] cursor-pointer" onClick={() => setOutletId('')}>
              Outlet <span className="ml-1 text-zinc-500">×</span>
            </Badge>
          )}
          {cashierId && (
            <Badge variant="outline" className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[11px] cursor-pointer" onClick={() => setCashierId('')}>
              Kasir: {cashiers.find(c => c.id === cashierId)?.name || cashierId} <span className="ml-1 text-zinc-500">×</span>
            </Badge>
          )}
          {paymentMethod && (
            <Badge variant="outline" className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[11px] cursor-pointer" onClick={() => setPaymentMethod('')}>
              Pembayaran: {paymentMethod} <span className="ml-1 text-zinc-500">×</span>
            </Badge>
          )}
          {voidFilter && (
            <Badge variant="outline" className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[11px] cursor-pointer" onClick={() => setVoidFilter('')}>
              Status: {voidFilter === 'active' ? 'Aktif' : 'Void'} <span className="ml-1 text-zinc-500">×</span>
            </Badge>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 bg-zinc-900 rounded" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
          <p className="text-xs text-zinc-500">Tidak ada transaksi ditemukan</p>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAllFilters}
              className="mt-2 text-zinc-500 hover:text-zinc-300 text-xs h-7"
            >
              Reset semua filter
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Mobile card view */}
          <div className="md:hidden space-y-2">
            {transactions.map((txn) => {
              const isVoid = txn.voidStatus === 'void'
              return (
                <div
                  key={txn.id}
                  className={`rounded-xl p-3 ${
                    isVoid
                      ? 'border border-red-500/20 bg-red-500/[0.03]'
                      : 'border border-zinc-800/60 bg-zinc-900'
                  }`}
                >
                  {/* Top row: Invoice + Badges */}
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <span className="text-xs text-emerald-400 font-mono font-medium truncate">
                      {txn.invoiceNumber}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {getPaymentBadge(txn.paymentMethod)}
                      {isVoid && (
                        <Badge className="bg-red-500/10 border-red-500/20 text-red-400 text-[10px] px-1.5 py-0">
                          <Ban className="mr-0.5 h-2.5 w-2.5" />
                          VOID
                        </Badge>
                      )}
                    </div>
                  </div>
                  {/* Middle row: Date + Customer */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-400">{formatDate(txn.createdAt)}</span>
                    <span className="text-xs text-zinc-300">{txn.customerName || 'Walk-in'}</span>
                  </div>
                  {/* Bottom row: Total + Items + Action */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${isVoid ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                        {formatCurrency(txn.total)}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {txn._count?.items || 0} item
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                      onClick={() => handleViewDetail(txn)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block rounded-lg border border-zinc-800 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-500 text-[11px] font-medium w-10"></TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium">Invoice #</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium hidden md:table-cell">Outlet</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium">Tanggal</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium hidden sm:table-cell">Customer</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium text-center">Pembayaran</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium text-right">Total</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium text-center hidden sm:table-cell">Item</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium text-center w-10 hidden sm:table-cell">Sync</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium text-right w-10">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((txn) => {
                  const isVoid = txn.voidStatus === 'void'
                  let rowClass = 'border-zinc-800 hover:bg-zinc-800/50'
                  if (isVoid) {
                    rowClass = 'border-zinc-800 bg-red-500/5 hover:bg-red-500/10'
                  }

                  return (
                    <TableRow key={txn.id} className={rowClass}>
                      {/* Void badge */}
                      <TableCell className="py-2.5 px-3">
                        {isVoid && (
                          <Badge className="bg-red-500/10 border-red-500/20 text-red-400 text-[10px] px-1.5 py-0">
                            <Ban className="mr-0.5 h-2.5 w-2.5" />
                            VOID
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-emerald-400 font-mono font-medium py-2.5 px-3">
                        {txn.invoiceNumber}
                      </TableCell>
                      {/* Outlet column (hidden on mobile) */}
                      <TableCell className="text-xs text-zinc-400 py-2.5 px-3 hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <Store className="h-3 w-3 text-zinc-500 shrink-0" />
                          <span className="truncate max-w-[120px]">{txn.outletName || 'Outlet Saat Ini'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-400 py-2.5 px-3">{formatDate(txn.createdAt)}</TableCell>
                      <TableCell className="text-xs text-zinc-300 py-2.5 px-3 hidden sm:table-cell">{txn.customerName || 'Walk-in'}</TableCell>
                      <TableCell className="text-center py-2.5 px-3">
                        {getPaymentBadge(txn.paymentMethod)}
                      </TableCell>
                      <TableCell className={`text-xs font-semibold text-right py-2.5 px-3 ${isVoid ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                        {formatCurrency(txn.total)}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-400 text-center py-2.5 px-3 hidden sm:table-cell">
                        {txn._count?.items || 0}
                      </TableCell>
                      <TableCell className="text-center py-2.5 px-3 hidden sm:table-cell">
                        {txn.syncStatus === 'synced' ? (
                          <span className="inline-flex items-center justify-center text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center text-amber-400">
                            <Clock className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right py-2.5 px-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                          onClick={() => handleViewDetail(txn)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-zinc-100 text-sm font-semibold">
                Detail Transaksi
              </DialogTitle>
              {detailTransaction?.voidStatus === 'void' && (
                <Badge className="bg-red-500/10 border-red-500/20 text-red-400 text-[10px]">
                  <Ban className="mr-0.5 h-2.5 w-2.5" />
                  VOID
                </Badge>
              )}
            </div>
          </DialogHeader>

          {detailTransaction && (
            <div className="space-y-3 py-1">
              {/* Receipt Preview */}
              <div className="rounded-lg border border-zinc-700 p-1">
                <div
                  ref={receiptRef}
                  className="bg-white rounded-md p-4 font-mono text-xs text-zinc-800 max-w-[300px] mx-auto"
                >
                  {/* Header with outlet info */}
                  <div className="text-center mb-3">
                    <p className="font-bold text-sm text-zinc-900">{detailOutlet?.name || 'Aether POS'}</p>
                    {detailOutlet?.address && (
                      <p className="text-zinc-500 text-[10px]">{detailOutlet.address}</p>
                    )}
                    {detailOutlet?.phone && (
                      <p className="text-zinc-500 text-[10px]">{detailOutlet.phone}</p>
                    )}
                  </div>

                  <div className="border-t border-dashed border-zinc-300 my-2" />

                  {/* Meta */}
                  <div className="space-y-0.5">
                    <div className="flex justify-between">
                      <span>No</span>
                      <span className="font-semibold">{detailTransaction.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tanggal</span>
                      <span>{formatDate(detailTransaction.createdAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Kasir</span>
                      <span>{detailCashierName || '-'}</span>
                    </div>
                    {detailTransaction.customerName && detailTransaction.customerName !== 'Walk-in' && (
                      <div className="flex justify-between">
                        <span>Customer</span>
                        <span>{detailTransaction.customerName}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Pembayaran</span>
                      <span>{detailTransaction.paymentMethod}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Outlet</span>
                      <span>{detailOutlet?.name || 'Outlet Saat Ini'}</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-zinc-300 my-2" />

                  {/* Items */}
                  {detailLoading ? (
                    <div className="space-y-2 py-2">
                      <Skeleton className="h-4 bg-zinc-200 rounded" />
                      <Skeleton className="h-4 bg-zinc-200 rounded" />
                    </div>
                  ) : (
                    <table className="w-full">
                      <tbody>
                        {detailItems.map((item) => (
                          <tr key={item.id}>
                            <td className="py-0.5 text-left">{item.productName}</td>
                            <td className="py-0.5 text-right text-zinc-500">{item.qty}</td>
                            <td className="py-0.5 text-right">{formatCurrency(item.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  <div className="border-t border-dashed border-zinc-300 my-2" />

                  {/* Totals */}
                  <div className="space-y-0.5">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>{formatCurrency(detailTransaction.subtotal ?? 0)}</span>
                    </div>
                    {(detailTransaction.discount ?? 0) > 0 && (
                      <div className="flex justify-between text-zinc-500">
                        <span>Diskon</span>
                        <span>-{formatCurrency(detailTransaction.discount ?? 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-sm border-t border-dashed border-zinc-300 pt-1">
                      <span>TOTAL</span>
                      <span>{formatCurrency(detailTransaction.total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Dibayar</span>
                      <span>{formatCurrency(detailTransaction.paidAmount ?? 0)}</span>
                    </div>
                    {(detailTransaction.change ?? 0) > 0 && (
                      <div className="flex justify-between">
                        <span>Kembalian</span>
                        <span>{formatCurrency(detailTransaction.change ?? 0)}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-dashed border-zinc-300 my-2" />

                  {/* Footer */}
                  <div className="text-center text-zinc-400 text-[10px]">
                    <p>Terima kasih atas kunjungan Anda!</p>
                  </div>
                </div>
              </div>

              {/* Print button */}
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 h-8 text-xs"
                >
                  <Printer className="mr-1.5 h-3 w-3" />
                  Cetak Struk
                </Button>
              </div>

              {/* Void info */}
              {detailVoidInfo && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-1">
                  <p className="text-xs font-semibold text-red-400 flex items-center gap-1">
                    <Ban className="h-3.5 w-3.5" />
                    Transaksi di-void
                  </p>
                  <p className="text-[11px] text-red-300/70">
                    Alasan: {detailVoidInfo.reason}
                  </p>
                  {detailVoidInfo.voidedBy && (
                    <p className="text-[11px] text-red-300/70">
                      Oleh: {detailVoidInfo.voidedBy}
                    </p>
                  )}
                </div>
              )}

              {/* Void button (OWNER only, only for active transactions) */}
              {isOwner && detailTransaction.voidStatus !== 'void' && (
                <div className="pt-2 border-t border-zinc-800">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVoidOpen(true)}
                    className="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 w-full h-8 text-xs"
                  >
                    <Ban className="mr-1.5 h-3 w-3" />
                    Void Transaksi
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Void Confirmation Dialog */}
      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-sm p-4">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 text-sm font-semibold">Void Transaksi</DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Transaksi <span className="text-emerald-400 font-mono">{detailTransaction?.invoiceNumber}</span> akan ditandai sebagai void. Data tetap tersimpan untuk audit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-xs">Alasan void <span className="text-red-400">*</span></Label>
              <Textarea
                placeholder="Masukkan alasan void..."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                rows={3}
                className="text-xs bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setVoidOpen(false)}
              disabled={voidSubmitting}
              className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 h-8 text-xs"
            >
              Batal
            </Button>
            <Button
              onClick={handleVoid}
              disabled={voidSubmitting || !voidReason.trim()}
              className="bg-red-500 hover:bg-red-600 text-white h-8 text-xs"
            >
              {voidSubmitting && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Void
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
