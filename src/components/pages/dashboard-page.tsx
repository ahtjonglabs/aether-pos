'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { formatCurrency, formatNumber } from '@/lib/format'
import { usePlan } from '@/hooks/use-plan'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  DollarSign,
  Receipt,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  BarChart3,
  Package,
  Crown,
  Clock,
  Zap,
} from 'lucide-react'

// ── Types ──
interface HourBucket {
  hour: number
  transactionCount: number
  revenue: number
}

interface DashboardStats {
  totalRevenue: number
  totalTransactions: number
  totalProducts: number
  lowStockProducts: number
  totalProfit: number | null
  topCustomers: { id: string; name: string; whatsapp: string; totalSpend: number; points: number }[]
  lowStockList: { id: string; name: string; stock: number; lowStockAlert: number }[]
  todayRevenue: number
  todayBrutto: number
  todayDiscount: number
  todayTransactions: number
  todayProfit: number | null
  yesterdayRevenue: number
  yesterdayTransactions: number
  revenueChangePercent: number
  peakHours: HourBucket[] | null
  aiInsight: string | null
}

const POLL_INTERVAL = 30_000

export default function DashboardPage() {
  const { data: session } = useSession()
  const { features, isLoading: planLoading } = usePlan()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isOwner = session?.user?.role === 'OWNER'
  const isPro = features?.apiAccess === true

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch {
      // silently retry on next interval
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Auto-refresh every 30s
  useEffect(() => {
    intervalRef.current = setInterval(fetchStats, POLL_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchStats])

  // ── Helpers ──
  const changePercent = stats?.revenueChangePercent ?? 0
  const isUp = changePercent >= 0
  const busiestHour = stats?.peakHours?.reduce(
    (max, b) => (b.transactionCount > max.transactionCount ? b : max),
    { hour: 0, transactionCount: 0, revenue: 0 }
  )
  const maxTxCount = stats?.peakHours
    ? Math.max(...stats.peakHours.map((b) => b.transactionCount), 1)
    : 1

  // ── Skeleton ──
  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <Skeleton className="h-6 w-40 bg-zinc-800 mb-1" />
          <Skeleton className="h-3 w-56 bg-zinc-800" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 bg-zinc-900 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Skeleton className="h-40 bg-zinc-900 rounded-lg col-span-1" />
          <Skeleton className="h-40 bg-zinc-900 rounded-lg col-span-1 lg:col-span-2" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-56 bg-zinc-900 rounded-lg" />
          <Skeleton className="h-56 bg-zinc-900 rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Dashboard</h1>
          <p className="text-xs text-zinc-500">
            Ringkasan performa outlet hari ini
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          SECTION 1 — Stat Cards Row
      ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Today's Revenue */}
        <Card className="bg-zinc-900 border border-emerald-500/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                Revenue Hari Ini
              </p>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <DollarSign className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="text-lg font-bold text-emerald-400">
              {stats ? formatCurrency(stats.todayRevenue) : '-'}
            </p>
            {/* Change badge */}
            <div className="flex items-center gap-1 mt-0.5">
              {stats && stats.yesterdayRevenue > 0 ? (
                <span
                  className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    isUp
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  {isUp ? (
                    <ArrowUpRight className="h-2.5 w-2.5" />
                  ) : (
                    <ArrowDownRight className="h-2.5 w-2.5" />
                  )}
                  {Math.abs(changePercent).toFixed(1)}%
                </span>
              ) : (
                <span className="text-[10px] text-zinc-500">vs kemarin</span>
              )}
              <span className="text-[10px] text-zinc-500">
                {stats ? `${formatNumber(stats.todayTransactions)} trx` : ''}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Today's Transactions */}
        <Card className="bg-zinc-900 border border-zinc-800">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                Transaksi Hari Ini
              </p>
              <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-100">
                <Receipt className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="text-lg font-bold text-zinc-100">
              {stats ? formatNumber(stats.todayTransactions) : '-'}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] text-zinc-500">kemarin: </span>
              <span className="text-[10px] text-zinc-400 font-medium">
                {stats ? formatNumber(stats.yesterdayTransactions) : '-'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Today's Profit — OWNER only */}
        {isOwner && (
          <Card className="bg-zinc-900 border border-amber-500/20">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                  Cuan Bersih
                </p>
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                  <TrendingUp className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="text-lg font-bold text-amber-400">
                {stats && stats.todayProfit !== null
                  ? formatCurrency(stats.todayProfit)
                  : '-'}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] text-zinc-500">total: </span>
                <span className="text-[10px] text-amber-400/70 font-medium">
                  {stats && stats.totalProfit !== null
                    ? formatCurrency(stats.totalProfit)
                    : '-'}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Low Stock */}
        <Card
          className={`bg-zinc-900 border ${
            stats && stats.lowStockProducts > 0
              ? 'border-red-500/20'
              : 'border-zinc-800'
          }`}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                Stok Menipis
              </p>
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  stats && stats.lowStockProducts > 0
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
              </div>
            </div>
            <p
              className={`text-lg font-bold ${
                stats && stats.lowStockProducts > 0
                  ? 'text-red-400'
                  : 'text-zinc-100'
              }`}
            >
              {stats ? formatNumber(stats.lowStockProducts) : '-'}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] text-zinc-500">
                {stats && stats.lowStockProducts > 0
                  ? `${stats.lowStockProducts} produk perlu restock`
                  : 'Semua stok aman'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All-time total (muted, compact) */}
      <Card className="bg-zinc-900/50 border border-zinc-800/50">
        <CardContent className="px-3 py-2 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs">
          <div className="flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-zinc-500">Total Produk:</span>
            <span className="text-zinc-200 font-medium">
              {stats ? formatNumber(stats.totalProducts) : '-'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-zinc-500">Total Revenue:</span>
            <span className="text-zinc-200 font-medium">
              {stats ? formatCurrency(stats.totalRevenue) : '-'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-zinc-500">Total Transaksi:</span>
            <span className="text-zinc-200 font-medium">
              {stats ? formatNumber(stats.totalTransactions) : '-'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════
          SECTION 2 — P&L Preview (OWNER only)
      ═══════════════════════════════════════════════════ */}
      {isOwner && (
        <Card className="bg-zinc-900 border border-zinc-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-3.5 w-3.5 text-amber-400" />
              <h2 className="text-sm font-semibold text-zinc-200">
                Laba & Rugi Hari Ini
              </h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="rounded-lg bg-zinc-800/60 border border-zinc-700/50 p-2.5">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">
                  Brutto
                </p>
                <p className="text-sm font-bold text-zinc-200">
                  {stats ? formatCurrency(stats.todayBrutto) : '-'}
                </p>
              </div>
              <div className="rounded-lg bg-zinc-800/60 border border-zinc-700/50 p-2.5">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">
                  Diskon
                </p>
                <p className="text-sm font-bold text-red-400">
                  {stats ? `- ${formatCurrency(stats.todayDiscount)}` : '-'}
                </p>
              </div>
              <div className="rounded-lg bg-zinc-800/60 border border-zinc-700/50 p-2.5">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">
                  Netto (Total)
                </p>
                <p className="text-sm font-bold text-emerald-400">
                  {stats ? formatCurrency(stats.todayRevenue) : '-'}
                </p>
              </div>
              <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-2.5">
                <p className="text-[10px] text-amber-500/70 uppercase tracking-wider mb-0.5">
                  Profit (Cuan)
                </p>
                <p className="text-sm font-bold text-amber-400">
                  {stats && stats.todayProfit !== null
                    ? formatCurrency(stats.todayProfit)
                    : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════
          SECTION 3 — Peak Hours Chart (OWNER only, Pro-gated)
      ═══════════════════════════════════════════════════ */}
      {isOwner && (
        <Card className="bg-zinc-900 border border-zinc-800">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-violet-400" />
                <h2 className="text-sm font-semibold text-zinc-200">
                  Jam Ramai Hari Ini
                </h2>
                {busiestHour && busiestHour.transactionCount > 0 && (
                  <Badge className="bg-violet-500/10 border-violet-500/20 text-violet-400 text-[10px]">
                    Puncak: {String(busiestHour.hour).padStart(2, '0')}:00
                  </Badge>
                )}
              </div>
              {!isPro && (
                <Badge className="bg-amber-500/10 border-amber-500/20 text-amber-400 text-[10px] gap-1">
                  <Crown className="h-3 w-3" />
                  PRO
                </Badge>
              )}
            </div>

            {!isPro ? (
              <div className="h-32 flex flex-col items-center justify-center text-center rounded-lg bg-zinc-800/40 border border-zinc-700/30">
                <Crown className="h-7 w-7 text-amber-400/50 mb-1.5" />
                <p className="text-xs text-zinc-400 font-medium">
                  Upgrade ke Pro untuk Peak Hours
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Analisa jam tersibuk untuk optimasi shift karyawan
                </p>
              </div>
            ) : (
              <div className="relative h-32">
                {/* Y-axis label */}
                <div className="absolute left-0 top-0 bottom-6 w-7 flex flex-col justify-between text-[10px] text-zinc-500">
                  <span>{maxTxCount}</span>
                  <span>{Math.round(maxTxCount / 2)}</span>
                  <span>0</span>
                </div>
                {/* Chart area */}
                <div className="ml-9 h-full flex items-end gap-[3px]">
                  {stats?.peakHours?.map((bucket) => {
                    const heightPct =
                      maxTxCount > 0
                        ? (bucket.transactionCount / maxTxCount) * 100
                        : 0
                    const isPeak =
                      busiestHour?.hour === bucket.hour &&
                      bucket.transactionCount > 0
                    return (
                      <div
                        key={bucket.hour}
                        className="flex-1 flex flex-col items-center gap-1 group relative"
                      >
                        {/* Tooltip */}
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                          <p className="text-zinc-300">
                            {String(bucket.hour).padStart(2, '0')}:00 —{' '}
                            {bucket.transactionCount} trx
                          </p>
                          <p className="text-emerald-400">
                            {formatCurrency(bucket.revenue)}
                          </p>
                        </div>
                        <div
                          className={`w-full rounded-t-sm transition-colors duration-150 ${
                            isPeak
                              ? 'bg-violet-500'
                              : bucket.transactionCount > 0
                                ? 'bg-emerald-500/60 hover:bg-emerald-400/80'
                                : 'bg-zinc-800'
                          }`}
                          style={{ height: `${Math.max(heightPct, 2)}%` }}
                        />
                        {/* Hour labels (show every 3h) */}
                        {bucket.hour % 3 === 0 && (
                          <span className="text-[9px] text-zinc-500 -mt-0.5">
                            {String(bucket.hour).padStart(2, '0')}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
                {/* X-axis line */}
                <div className="ml-9 mt-0 h-px bg-zinc-700/50" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════
          SECTION 4 — AI Insight (OWNER only, Pro-gated)
      ═══════════════════════════════════════════════════ */}
      {isOwner && (
        <Card className="bg-zinc-900 border border-zinc-800">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <h2 className="text-sm font-semibold text-zinc-200">
                  AI Insight
                </h2>
              </div>
              {!isPro && (
                <Badge className="bg-amber-500/10 border-amber-500/20 text-amber-400 text-[10px] gap-1">
                  <Crown className="h-3 w-3" />
                  PRO
                </Badge>
              )}
            </div>

            {!isPro ? (
              <div className="flex items-center gap-2.5 rounded-lg bg-zinc-800/40 border border-zinc-700/30 p-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 text-amber-400/60" />
                </div>
                <div>
                  <p className="text-xs text-zinc-300 font-medium">
                    Upgrade ke Pro untuk AI Insight
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Dapatkan rekomendasi cerdas berbasis data penjualan Anda
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 rounded-lg bg-gradient-to-br from-amber-500/5 to-violet-500/5 border border-amber-500/10 p-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {stats?.aiInsight ?? 'Memuat insight...'}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════
          SECTION 5 & 6 — Top Customers + Low Stock Tables
      ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Customers */}
        <Card className="bg-zinc-900 border border-zinc-800">
          <CardContent className="p-3">
            <h2 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              Top Customers
            </h2>
            {(!stats?.topCustomers || stats.topCustomers.length === 0) ? (
              <p className="text-xs text-zinc-500 py-6 text-center">
                Belum ada customer
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-zinc-500 text-[11px] w-8 py-2">#</TableHead>
                      <TableHead className="text-zinc-500 text-[11px] py-2">Nama</TableHead>
                      <TableHead className="text-zinc-500 text-[11px] text-right py-2">
                        Total Spend
                      </TableHead>
                      <TableHead className="text-zinc-500 text-[11px] text-center py-2">
                        Poin
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.topCustomers.slice(0, 5).map((c, idx) => (
                      <TableRow
                        key={c.id}
                        className="border-zinc-800 hover:bg-zinc-800/50"
                      >
                        <TableCell className="text-[11px] text-zinc-500 font-mono py-2">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="py-2">
                          <div>
                            <p className="text-xs text-zinc-200 font-medium">
                              {c.name}
                            </p>
                            <p className="text-[10px] text-zinc-500">
                              {c.whatsapp}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-zinc-200 text-right font-medium py-2">
                          {formatCurrency(c.totalSpend)}
                        </TableCell>
                        <TableCell className="text-center py-2">
                          <Badge className="bg-amber-500/10 border-amber-500/20 text-amber-400 text-[10px]">
                            {c.points} pts
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Products */}
        <Card className="bg-zinc-900 border border-zinc-800">
          <CardContent className="p-3">
            <h2 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
              Produk Stok Menipis
            </h2>
            {(!stats?.lowStockList || stats.lowStockList.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Package className="h-7 w-7 text-emerald-500/40 mb-1.5" />
                <p className="text-xs text-zinc-500">Semua stok aman</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-60 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-transparent sticky top-0 bg-zinc-900">
                      <TableHead className="text-zinc-500 text-[11px] w-8 py-2">#</TableHead>
                      <TableHead className="text-zinc-500 text-[11px] py-2">
                        Produk
                      </TableHead>
                      <TableHead className="text-zinc-500 text-[11px] text-right py-2">
                        Stok
                      </TableHead>
                      <TableHead className="text-zinc-500 text-[11px] text-right py-2">
                        Alert
                      </TableHead>
                      <TableHead className="text-zinc-500 text-[11px] text-center py-2">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.lowStockList.map((p, idx) => {
                      const isCritical = p.stock === 0
                      const isWarning = p.stock > 0 && p.stock <= p.lowStockAlert / 2
                      return (
                        <TableRow
                          key={p.id}
                          className="border-zinc-800 hover:bg-zinc-800/50"
                        >
                          <TableCell className="text-[11px] text-zinc-500 font-mono py-2">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="text-xs text-zinc-200 font-medium py-2">
                            {p.name}
                          </TableCell>
                          <TableCell
                            className={`text-xs text-right font-semibold py-2 ${
                              isCritical
                                ? 'text-red-400'
                                : isWarning
                                  ? 'text-amber-400'
                                  : 'text-yellow-300'
                            }`}
                          >
                            {p.stock}
                          </TableCell>
                          <TableCell className="text-xs text-zinc-400 text-right py-2">
                            {p.lowStockAlert}
                          </TableCell>
                          <TableCell className="text-center py-2">
                            {isCritical ? (
                              <Badge className="bg-red-500/10 border-red-500/20 text-red-400 text-[10px]">
                                Habis
                              </Badge>
                            ) : isWarning ? (
                              <Badge className="bg-amber-500/10 border-amber-500/20 text-amber-400 text-[10px]">
                                Kritis
                              </Badge>
                            ) : (
                              <Badge className="bg-yellow-500/10 border-yellow-500/20 text-yellow-400 text-[10px]">
                                Rendah
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
