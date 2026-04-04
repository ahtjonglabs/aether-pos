'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
  ResponsiveDialogDescription,
} from '@/components/ui/responsive-dialog'
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
  ShoppingBag,
  AlertTriangle,
  Hash,
  Package,
  ArrowUpRight,
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
  totalBrutto: number
  totalDiscount: number
  totalTransactions: number
  avgTransaction: number
  totalItemsSold: number
  paymentBreakdown: { method: string; count: number; total: number }[]
  topProducts: { rank: number; name: string; quantity: number; revenue: number }[]
  hourlyBreakdown: { hour: number; count: number }[]
  voidInfo: { count: number; total: number }
}

function getTodayLocal(): string {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

/** Get start-of-day in local time as milliseconds (timezone-safe) */
function getStartOfDayMs(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
}

/** Get end-of-day in local time as milliseconds (timezone-safe) */
function getEndOfDayMs(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime()
}

const PAYMENT_COLORS: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
  CASH: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', iconBg: 'bg-emerald-500/10' },
  QRIS: { bg: 'bg-sky-500/10', border: 'border-sky-500/20', text: 'text-sky-400', iconBg: 'bg-sky-500/10' },
  DEBIT: { bg: 'bg-violet-500/10', border: 'border-violet-500/20', text: 'text-violet-400', iconBg: 'bg-violet-500/10' },
}

const PAYMENT_BAR_COLORS: Record<string, string> = {
  CASH: 'bg-emerald-500',
  QRIS: 'bg-sky-500',
  DEBIT: 'bg-violet-500',
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

export default function TransactionsPage() {
  const { data: session } = useSession()
  const isOwner = session?.user?.role === 'OWNER'
  const { plan } = usePlan()
  const isPro = plan?.type === 'pro' || plan?.type === 'enterprise'

  // Active tab
  const [activeTab, setActiveTab] = useState('transactions')

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState(getTodayLocal)
  const [dateTo, setDateTo] = useState(getTodayLocal)
  const [cashierId, setCashierId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [voidFilter, setVoidFilter] = useState('')
  const [outletId, setOutletId] = useState('')

  // Cashier list
  const [cashiers, setCashiers] = useState<CashierOption[]>([])
  const cashiersPopulated = useRef(false)

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
      const tzOffset = new Date().getTimezoneOffset()
      if (dateFrom) {
        params.set('dateFrom', dateFrom)
        params.set('tzOffset', String(tzOffset))
      }
      if (dateTo) params.set('dateTo', dateTo)
      // Keep dateFromMs/dateToMs as fallback for old server code
      if (dateFrom) params.set('dateFromMs', String(getStartOfDayMs(dateFrom)))
      if (dateTo) params.set('dateToMs', String(getEndOfDayMs(dateTo)))
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
      const tzOffset = new Date().getTimezoneOffset()
      if (dateFrom) {
        params.set('dateFrom', dateFrom)
        params.set('tzOffset', String(tzOffset))
      }
      if (dateTo) params.set('dateTo', dateTo)
      // Keep dateFromMs/dateToMs as fallback for old server code
      if (dateFrom) params.set('dateFromMs', String(getStartOfDayMs(dateFrom)))
      if (dateTo) params.set('dateToMs', String(getEndOfDayMs(dateTo)))
      if (cashierId) params.set('cashierId', cashierId)
      if (paymentMethod) params.set('paymentMethod', paymentMethod)
      if (voidFilter) params.set('voidStatus', voidFilter)
      const res = await fetch(`/api/transactions?${params}`)
      if (res.ok) {
        const data: TransactionListResponse = await res.json()
        setTransactions(data.transactions)
        setTotalPages(data.totalPages)

        // Update cashier list from response (only if not already populated)
        if (!cashiersPopulated.current) {
          const uniqueCashiers = new Map<string, string>()
          for (const t of data.transactions) {
            if (t.cashierId && t.cashierName && !uniqueCashiers.has(t.cashierId)) {
              uniqueCashiers.set(t.cashierId, t.cashierName)
            }
          }
          if (uniqueCashiers.size > 0) {
            cashiersPopulated.current = true
            setCashiers(Array.from(uniqueCashiers.entries()).map(([id, name]) => ({ id, name })))
          }
        }
      } else {
        toast.error('Failed to load transactions')
      }
    } catch {
      toast.error('Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }, [page, search, dateFrom, dateTo, cashierId, paymentMethod, voidFilter])

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
    const today = getTodayLocal()
    setDateFrom(today)
    setDateTo(today)
  }

  const handleClearDates = () => {
    setDateFrom('')
    setDateTo('')
  }

  const handleClearAllFilters = () => {
    setDateFrom(getTodayLocal)
    setDateTo(getTodayLocal)
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
    if (dateFrom) params.set('dateFromMs', String(getStartOfDayMs(dateFrom)))
    if (dateTo) params.set('dateToMs', String(getEndOfDayMs(dateTo)))
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

  // --- Payment badge helpers ---
  const getPaymentBadge = (method: string) => {
    const colors = PAYMENT_COLORS[method]
    if (!colors) return <Badge className="text-[10px]">{method}</Badge>
    const icon = method === 'CASH' ? <Banknote className="mr-0.5 h-2.5 w-2.5" />
      : method === 'QRIS' ? <QrCode className="mr-0.5 h-2.5 w-2.5" />
      : <CreditCard className="mr-0.5 h-2.5 w-2.5" />
    return (
      <Badge className={`${colors.bg} ${colors.border} ${colors.text} text-[10px]`}>
        {icon}{method}
      </Badge>
    )
  }

  const getPaymentIcon = (method: string) => {
    const colors = PAYMENT_COLORS[method]
    if (!colors) return null
    const icon = method === 'CASH' ? <Banknote className="h-3.5 w-3.5" />
      : method === 'QRIS' ? <QrCode className="h-3.5 w-3.5" />
      : <CreditCard className="h-3.5 w-3.5" />
    return (
      <div className={`w-7 h-7 rounded-lg ${colors.iconBg} flex items-center justify-center ${colors.text}`}>
        {icon}
      </div>
    )
  }

  // --- Hourly chart max ---
  const hourlyMax = useMemo(() => {
    if (!summary) return 1
    return Math.max(...summary.hourlyBreakdown.map(h => h.count), 1)
  }, [summary])

  // --- Payment bar max ---
  const paymentMax = useMemo(() => {
    if (!summary) return 1
    return Math.max(...summary.paymentBreakdown.map(p => p.total), 1)
  }, [summary])

  // --- Closing Tab Content ---
  const renderClosingTab = () => (
    <ProGate
      feature="transactionSummary"
      label="Closing Harian"
      description="Lihat ringkasan closing harian per outlet"
      minHeight="400px"
    >
      {summaryLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 bg-zinc-900 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-40 bg-zinc-900 rounded-xl" />
          <Skeleton className="h-48 bg-zinc-900 rounded-xl" />
        </div>
      ) : summary ? (
        <div className="space-y-4">
          {/* Today's Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Total Revenue */}
            <Card className="bg-zinc-900 border-zinc-800 rounded-xl overflow-hidden relative">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-500/10 to-transparent rounded-bl-full" />
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  </div>
                  <span className="text-[11px] text-zinc-500 font-medium">Total Pendapatan</span>
                </div>
                <p className="text-xl lg:text-2xl font-bold text-emerald-400 tracking-tight">
                  {formatCurrency(summary.totalRevenue)}
                </p>
                <p className="text-[10px] text-zinc-500 mt-1">
                  {dateFrom && dateTo && dateFrom === dateTo ? 'Hari ini' : `${dateFrom || '...'} — ${dateTo || '...'}`}
                </p>
              </CardContent>
            </Card>

            {/* Total Transactions */}
            <Card className="bg-zinc-900 border-zinc-800 rounded-xl overflow-hidden relative">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-sky-500/10 to-transparent rounded-bl-full" />
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                    <Receipt className="h-4 w-4 text-sky-400" />
                  </div>
                  <span className="text-[11px] text-zinc-500 font-medium">Transaksi</span>
                </div>
                <p className="text-xl lg:text-2xl font-bold text-zinc-100 tracking-tight">
                  {summary.totalTransactions}
                </p>
                <p className="text-[10px] text-zinc-500 mt-1">Non-void</p>
              </CardContent>
            </Card>

            {/* Average Transaction */}
            <Card className="bg-zinc-900 border-zinc-800 rounded-xl overflow-hidden relative">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-violet-500/10 to-transparent rounded-bl-full" />
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <BarChart3 className="h-4 w-4 text-violet-400" />
                  </div>
                  <span className="text-[11px] text-zinc-500 font-medium">Rata-rata</span>
                </div>
                <p className="text-xl lg:text-2xl font-bold text-zinc-100 tracking-tight">
                  {formatCurrency(summary.avgTransaction)}
                </p>
                <p className="text-[10px] text-zinc-500 mt-1">Per transaksi</p>
              </CardContent>
            </Card>

            {/* Total Items Sold */}
            <Card className="bg-zinc-900 border-zinc-800 rounded-xl overflow-hidden relative">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-bl-full" />
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <ShoppingBag className="h-4 w-4 text-amber-400" />
                  </div>
                  <span className="text-[11px] text-zinc-500 font-medium">Item Terjual</span>
                </div>
                <p className="text-xl lg:text-2xl font-bold text-zinc-100 tracking-tight">
                  {summary.totalItemsSold}
                </p>
                <p className="text-[10px] text-zinc-500 mt-1">Total unit</p>
              </CardContent>
            </Card>
          </div>

          {/* Brutto / Netto / Diskon Summary */}
          <div className="grid grid-cols-3 gap-3">
            {/* Brutto */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
              <span className="text-[10px] text-zinc-500 font-medium">Brutto</span>
              <p className="text-base font-bold text-zinc-100 tracking-tight mt-1">
                {formatCurrency(summary.totalBrutto)}
              </p>
              <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden mt-2.5">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all duration-700"
                  style={{ width: `${summary.totalBrutto > 0 ? 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Diskon */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
              <span className="text-[10px] text-red-400/70 font-medium">Diskon</span>
              <p className="text-base font-bold text-red-400 tracking-tight mt-1">
                - {formatCurrency(summary.totalDiscount)}
              </p>
              <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden mt-2.5">
                <div
                  className="h-full rounded-full bg-red-400 transition-all duration-700"
                  style={{ width: `${summary.totalBrutto > 0 ? (summary.totalDiscount / summary.totalBrutto) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Netto */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
              <span className="text-[10px] text-emerald-500/70 font-medium">Netto</span>
              <p className="text-base font-bold text-emerald-400 tracking-tight mt-1">
                {formatCurrency(summary.totalRevenue)}
              </p>
              <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden mt-2.5">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                  style={{ width: `${summary.totalBrutto > 0 ? (summary.totalRevenue / summary.totalBrutto) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Two-column: Payment Breakdown + Hourly Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Revenue by Payment Method */}
            <Card className="bg-zinc-900 border-zinc-800 rounded-xl">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                  <CreditCard className="h-3.5 w-3.5 text-zinc-500" />
                  Pendapatan per Metode
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                {summary.paymentBreakdown.length > 0 ? (
                  summary.paymentBreakdown.map((pb) => {
                    const pct = paymentMax > 0 ? (pb.total / paymentMax) * 100 : 0
                    const barColor = PAYMENT_BAR_COLORS[pb.method] || 'bg-zinc-500'
                    return (
                      <div key={pb.method} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getPaymentIcon(pb.method)}
                            <div>
                              <span className="text-xs font-medium text-zinc-200">{pb.method}</span>
                              <span className="text-[10px] text-zinc-500 ml-1.5">{pb.count} transaksi</span>
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-zinc-200">{formatCurrency(pb.total)}</span>
                        </div>
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-xs text-zinc-500 text-center py-4">Belum ada data</p>
                )}
              </CardContent>
            </Card>

            {/* Hourly Breakdown */}
            <Card className="bg-zinc-900 border-zinc-800 rounded-xl">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-zinc-500" />
                  Transaksi per Jam
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex items-end gap-1 h-32">
                  {summary.hourlyBreakdown
                    .filter(h => h.hour >= 6 && h.hour <= 23)
                    .map((h) => {
                      const height = hourlyMax > 0 ? (h.count / hourlyMax) * 100 : 0
                      const isPeak = h.count > 0 && h.count === Math.max(...summary.hourlyBreakdown.map(x => x.count))
                      return (
                        <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                          {h.count > 0 && (
                            <span className="text-[9px] text-zinc-400 font-medium">{h.count}</span>
                          )}
                          <div className="w-full flex items-end" style={{ height: '80px' }}>
                            <div
                              className={`w-full rounded-t-sm transition-all duration-500 ${isPeak ? 'bg-emerald-500' : h.count > 0 ? 'bg-zinc-600' : 'bg-zinc-800'}`}
                              style={{ height: `${Math.max(height, h.count > 0 ? 4 : 2)}%` }}
                            />
                          </div>
                          <span className="text-[8px] text-zinc-600">{h.hour}</span>
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Two-column: Top Products + Void Transactions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Top 5 Products Today */}
            <Card className="bg-zinc-900 border-zinc-800 rounded-xl">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                  <Trophy className="h-3.5 w-3.5 text-amber-400" />
                  Top 5 Produk Hari Ini
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {summary.topProducts.length > 0 ? (
                  <div className="space-y-2">
                    {summary.topProducts.map((p) => (
                      <div key={p.rank} className="flex items-center gap-3 py-1">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          p.rank === 1
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                            : p.rank === 2
                              ? 'bg-zinc-400/10 text-zinc-400 border border-zinc-400/20'
                              : p.rank === 3
                                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                        }`}>
                          {p.rank}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-zinc-200 truncate">{p.name}</p>
                          <p className="text-[10px] text-zinc-500">{p.quantity} terjual</p>
                        </div>
                        <span className="text-xs font-semibold text-zinc-200 shrink-0">{formatCurrency(p.revenue)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 text-center py-4">Belum ada data</p>
                )}
              </CardContent>
            </Card>

            {/* Void Transactions */}
            <Card className="bg-zinc-900 border-zinc-800 rounded-xl">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                  Transaksi Void
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                    <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                      <Ban className="h-5 w-5 text-red-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-zinc-300">Total Void</p>
                      <p className="text-lg font-bold text-red-400">{summary.voidInfo.count} transaksi</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-[10px] text-zinc-500">Nilai Void</p>
                      <p className="text-sm font-semibold text-red-300/70">{formatCurrency(summary.voidInfo.total)}</p>
                    </div>
                  </div>

                  {summary.totalRevenue > 0 && summary.voidInfo.count > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-zinc-500">Void Ratio</span>
                        <span className="text-zinc-400 font-medium">
                          {((summary.voidInfo.count / (summary.totalTransactions + summary.voidInfo.count)) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-500/60 rounded-full"
                          style={{
                            width: `${Math.min((summary.voidInfo.count / (summary.totalTransactions + summary.voidInfo.count)) * 100, 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {summary.voidInfo.count === 0 && (
                    <div className="text-center py-2">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500/40 mx-auto mb-2" />
                      <p className="text-xs text-zinc-500">Tidak ada transaksi void hari ini</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-zinc-900 border-zinc-800 rounded-xl">
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
  )

  // --- Transactions Tab Content ---
  const renderTransactionsTab = () => (
    <>
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
            <Skeleton key={i} className="h-14 bg-zinc-900 rounded-xl" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <Receipt className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-xs text-zinc-500">Tidak ada transaksi ditemukan</p>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAllFilters}
              className="mt-3 text-zinc-500 hover:text-zinc-300 text-xs h-7"
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
                  className={`rounded-xl border-l-4 p-3.5 transition-colors ${
                    isVoid
                      ? 'border-l-red-500 border border-red-500/15 bg-red-500/[0.03]'
                      : 'border-l-emerald-500/50 border border-zinc-800/60 bg-zinc-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2.5 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {getPaymentIcon(txn.paymentMethod)}
                      <div className="min-w-0">
                        <span className="text-xs text-emerald-400 font-mono font-medium block truncate">
                          {txn.invoiceNumber}
                        </span>
                        <span className="text-[10px] text-zinc-500">{formatDate(txn.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isVoid && (
                        <Badge className="bg-red-500/10 border-red-500/20 text-red-400 text-[10px] px-1.5 py-0">
                          VOIDED
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div>
                        <span className={`text-sm font-semibold block ${isVoid ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>
                          {formatCurrency(txn.total)}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-zinc-500">{txn._count?.items || 0} item</span>
                          <span className="text-[10px] text-zinc-600">·</span>
                          <span className="text-[10px] text-zinc-500 truncate max-w-[100px]">{txn.customerName || 'Walk-in'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                        onClick={() => handleViewDetail(txn)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {isOwner && !isVoid && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                          onClick={() => { setDetailTransaction(txn); setVoidOpen(true) }}
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block rounded-xl border border-zinc-800 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent bg-zinc-900/50">
                  <TableHead className="text-zinc-500 text-[11px] font-medium w-10"></TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium">Invoice #</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium hidden lg:table-cell">Outlet</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium">Tanggal</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium hidden md:table-cell">Customer</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium text-center">Pembayaran</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium text-right">Total</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium text-center hidden md:table-cell">Item</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium text-center w-10 hidden lg:table-cell">Sync</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium text-right w-20">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((txn) => {
                  const isVoid = txn.voidStatus === 'void'
                  return (
                    <TableRow
                      key={txn.id}
                      className={`border-zinc-800/60 transition-colors ${
                        isVoid
                          ? 'border-l-2 border-l-red-500 bg-red-500/[0.02] hover:bg-red-500/5'
                          : 'hover:bg-zinc-800/40'
                      }`}
                    >
                      {/* Void indicator */}
                      <TableCell className="py-3 px-3">
                        {isVoid && (
                          <Badge className="bg-red-500/10 border-red-500/20 text-red-400 text-[10px] px-1.5 py-0">
                            <Ban className="mr-0.5 h-2.5 w-2.5" />
                            VOID
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-emerald-400 font-mono font-medium py-3 px-3">
                        {txn.invoiceNumber}
                      </TableCell>
                      {/* Outlet column */}
                      <TableCell className="text-xs text-zinc-400 py-3 px-3 hidden lg:table-cell">
                        <div className="flex items-center gap-1.5">
                          <Store className="h-3 w-3 text-zinc-500 shrink-0" />
                          <span className="truncate max-w-[120px]">{txn.outletName || 'Outlet Saat Ini'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-400 py-3 px-3">{formatDate(txn.createdAt)}</TableCell>
                      <TableCell className="text-xs text-zinc-300 py-3 px-3 hidden md:table-cell">{txn.customerName || 'Walk-in'}</TableCell>
                      <TableCell className="text-center py-3 px-3">
                        {getPaymentBadge(txn.paymentMethod)}
                      </TableCell>
                      <TableCell className={`text-xs font-semibold text-right py-3 px-3 ${isVoid ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>
                        {formatCurrency(txn.total)}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-400 text-center py-3 px-3 hidden md:table-cell">
                        {txn._count?.items || 0}
                      </TableCell>
                      <TableCell className="text-center py-3 px-3 hidden lg:table-cell">
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
                      <TableCell className="text-right py-3 px-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                            onClick={() => handleViewDetail(txn)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {isOwner && !isVoid && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                              onClick={() => { setDetailTransaction(txn); setVoidOpen(true) }}
                            >
                              <Ban className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
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
    </>
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Transaksi</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Lihat semua transaksi dan ringkasan harian</p>
      </div>

      {/* Date bar (shared across tabs) */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <CalendarDays className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-100 w-full sm:w-[140px] [color-scheme:dark]"
          />
          <span className="text-zinc-600 text-[11px]">—</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-100 w-full sm:w-[140px] [color-scheme:dark]"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSetToday}
          className="text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 text-[11px] h-8 px-2.5 rounded-full"
        >
          Hari Ini
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
          onClick={handleClearAllFilters}
          title="Reset filter"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-zinc-900 border border-zinc-800 rounded-lg h-9 p-0.5">
          <TabsTrigger
            value="transactions"
            className="text-xs px-3 h-8 rounded-md data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-400 data-[state=active]:shadow-sm"
          >
            <Receipt className="mr-1.5 h-3.5 w-3.5" />
            Daftar Transaksi
          </TabsTrigger>
          <TabsTrigger
            value="closing"
            className="text-xs px-3 h-8 rounded-md data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-400 data-[state=active]:shadow-sm"
          >
            <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
            Closing Harian
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-4 space-y-3">
          {renderTransactionsTab()}
        </TabsContent>

        <TabsContent value="closing" className="mt-4">
          {renderClosingTab()}
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <ResponsiveDialog open={detailOpen} onOpenChange={setDetailOpen}>
        <ResponsiveDialogContent className="bg-zinc-900 border-zinc-800 max-h-[90vh] overflow-y-auto p-0" desktopClassName="max-w-md sm:max-w-lg">
          {detailTransaction && (
            <>
              {/* Dialog Header */}
              <div className="p-4 pb-3 border-b border-zinc-800/60">
                <ResponsiveDialogHeader>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {getPaymentIcon(detailTransaction.paymentMethod)}
                      <div className="min-w-0">
                        <ResponsiveDialogTitle className="text-zinc-100 text-sm font-semibold font-mono truncate block">
                          {detailTransaction.invoiceNumber}
                        </ResponsiveDialogTitle>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{formatDate(detailTransaction.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {getPaymentBadge(detailTransaction.paymentMethod)}
                      {detailTransaction.voidStatus === 'void' && (
                        <Badge className="bg-red-500/10 border-red-500/20 text-red-400 text-[10px]">
                          <Ban className="mr-0.5 h-2.5 w-2.5" />
                          VOIDED
                        </Badge>
                      )}
                    </div>
                  </div>
                </ResponsiveDialogHeader>
              </div>

              <div className="p-4 space-y-4">
                {/* Info Row */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-zinc-800/50 p-2.5 space-y-1">
                    <p className="text-[10px] text-zinc-500">Kasir</p>
                    <p className="text-xs text-zinc-200 font-medium">{detailCashierName || '-'}</p>
                  </div>
                  <div className="rounded-lg bg-zinc-800/50 p-2.5 space-y-1">
                    <p className="text-[10px] text-zinc-500">Customer</p>
                    <p className="text-xs text-zinc-200 font-medium">{detailTransaction.customerName || 'Walk-in'}</p>
                  </div>
                  <div className="rounded-lg bg-zinc-800/50 p-2.5 space-y-1">
                    <p className="text-[10px] text-zinc-500">Outlet</p>
                    <p className="text-xs text-zinc-200 font-medium truncate">{detailOutlet?.name || 'Outlet Saat Ini'}</p>
                  </div>
                  <div className="rounded-lg bg-zinc-800/50 p-2.5 space-y-1">
                    <p className="text-[10px] text-zinc-500">Item</p>
                    <p className="text-xs text-zinc-200 font-medium">{detailLoading ? '-' : detailItems.length} produk</p>
                  </div>
                </div>

                {/* Items List */}
                <div className="rounded-lg border border-zinc-800 overflow-hidden">
                  <div className="px-3 py-2 bg-zinc-800/40 border-b border-zinc-800/60">
                    <p className="text-[11px] font-medium text-zinc-400">Item Pesanan</p>
                  </div>
                  {detailLoading ? (
                    <div className="p-3 space-y-2">
                      <Skeleton className="h-8 bg-zinc-800 rounded" />
                      <Skeleton className="h-8 bg-zinc-800 rounded" />
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-800/40">
                      {detailItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-zinc-200 truncate">{item.productName}</p>
                            <p className="text-[10px] text-zinc-500">{formatCurrency(item.price)} × {item.qty}</p>
                          </div>
                          <span className="text-xs font-medium text-zinc-200 shrink-0 ml-3">{formatCurrency(item.subtotal)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payment Summary */}
                <div className="rounded-lg border border-zinc-800 overflow-hidden">
                  <div className="px-3 py-2 bg-zinc-800/40 border-b border-zinc-800/60">
                    <p className="text-[11px] font-medium text-zinc-400">Ringkasan Pembayaran</p>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-400">Subtotal</span>
                      <span className="text-zinc-200">{formatCurrency(detailTransaction.subtotal ?? 0)}</span>
                    </div>
                    {(detailTransaction.discount ?? 0) > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-400">Diskon</span>
                        <span className="text-amber-400">-{formatCurrency(detailTransaction.discount ?? 0)}</span>
                      </div>
                    )}
                    <Separator className="bg-zinc-800" />
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-zinc-200">Total</span>
                      <span className="font-bold text-emerald-400">{formatCurrency(detailTransaction.total)}</span>
                    </div>
                    <Separator className="bg-zinc-800" />
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-400">Dibayar</span>
                      <span className="text-zinc-200">{formatCurrency(detailTransaction.paidAmount ?? 0)}</span>
                    </div>
                    {(detailTransaction.change ?? 0) > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-400">Kembalian</span>
                        <span className="text-zinc-200">{formatCurrency(detailTransaction.change ?? 0)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Receipt Preview (hidden, for printing) */}
                <div className="hidden">
                  <div ref={receiptRef} className="bg-white rounded-md p-4 font-mono text-xs text-zinc-800 max-w-[300px] mx-auto">
                    <div className="text-center mb-3">
                      <p className="font-bold text-sm text-zinc-900">{detailOutlet?.name || 'Aether POS'}</p>
                      {detailOutlet?.address && <p className="text-zinc-500 text-[10px]">{detailOutlet.address}</p>}
                      {detailOutlet?.phone && <p className="text-zinc-500 text-[10px]">{detailOutlet.phone}</p>}
                    </div>
                    <div className="border-t border-dashed border-zinc-300 my-2" />
                    <div className="space-y-0.5">
                      <div className="flex justify-between"><span>No</span><span className="font-semibold">{detailTransaction.invoiceNumber}</span></div>
                      <div className="flex justify-between"><span>Tanggal</span><span>{formatDate(detailTransaction.createdAt)}</span></div>
                      <div className="flex justify-between"><span>Kasir</span><span>{detailCashierName || '-'}</span></div>
                      {detailTransaction.customerName && detailTransaction.customerName !== 'Walk-in' && (
                        <div className="flex justify-between"><span>Customer</span><span>{detailTransaction.customerName}</span></div>
                      )}
                      <div className="flex justify-between"><span>Pembayaran</span><span>{detailTransaction.paymentMethod}</span></div>
                    </div>
                    <div className="border-t border-dashed border-zinc-300 my-2" />
                    <table className="w-full"><tbody>
                      {detailItems.map((item) => (
                        <tr key={item.id}>
                          <td className="py-0.5 text-left">{item.productName}</td>
                          <td className="py-0.5 text-right text-zinc-500">{item.qty}</td>
                          <td className="py-0.5 text-right">{formatCurrency(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody></table>
                    <div className="border-t border-dashed border-zinc-300 my-2" />
                    <div className="space-y-0.5">
                      <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(detailTransaction.subtotal ?? 0)}</span></div>
                      {(detailTransaction.discount ?? 0) > 0 && (
                        <div className="flex justify-between text-zinc-500"><span>Diskon</span><span>-{formatCurrency(detailTransaction.discount ?? 0)}</span></div>
                      )}
                      <div className="flex justify-between font-bold text-sm border-t border-dashed border-zinc-300 pt-1"><span>TOTAL</span><span>{formatCurrency(detailTransaction.total)}</span></div>
                      <div className="flex justify-between"><span>Dibayar</span><span>{formatCurrency(detailTransaction.paidAmount ?? 0)}</span></div>
                      {(detailTransaction.change ?? 0) > 0 && (
                        <div className="flex justify-between"><span>Kembalian</span><span>{formatCurrency(detailTransaction.change ?? 0)}</span></div>
                      )}
                    </div>
                    <div className="border-t border-dashed border-zinc-300 my-2" />
                    <div className="text-center text-zinc-400 text-[10px]"><p>Terima kasih atas kunjungan Anda!</p></div>
                  </div>
                </div>

                {/* Void Info */}
                {detailVoidInfo && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
                      <Ban className="h-3.5 w-3.5" />
                      Transaksi di-void
                    </p>
                    <p className="text-[11px] text-red-300/70">
                      Alasan: {detailVoidInfo.reason}
                    </p>
                    {detailVoidInfo.voidedBy && (
                      <p className="text-[11px] text-red-300/70">
                        Oleh: {detailVoidInfo.voidedBy} {detailVoidInfo.voidedAt && `· ${formatDate(detailVoidInfo.voidedAt)}`}
                      </p>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrint}
                    className="flex-1 bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 h-9 text-xs"
                  >
                    <Printer className="mr-1.5 h-3.5 w-3.5" />
                    Cetak Struk
                  </Button>
                  {isOwner && detailTransaction.voidStatus !== 'void' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVoidOpen(true)}
                      className="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 h-9 text-xs"
                    >
                      <Ban className="mr-1.5 h-3.5 w-3.5" />
                      Void
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Void Confirmation Dialog */}
      <ResponsiveDialog open={voidOpen} onOpenChange={setVoidOpen}>
        <ResponsiveDialogContent className="bg-zinc-900 border-zinc-800 p-4" desktopClassName="max-w-sm">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="text-zinc-100 text-sm font-semibold">Void Transaksi</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="text-zinc-400 text-xs">
              Transaksi <span className="text-emerald-400 font-mono">{detailTransaction?.invoiceNumber}</span> akan ditandai sebagai void. Data tetap tersimpan untuk audit.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
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
          <ResponsiveDialogFooter>
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
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  )
}
