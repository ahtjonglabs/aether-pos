'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { formatCurrency, formatNumber } from '@/lib/format'
import { usePlan } from '@/hooks/use-plan'
import { usePageStore } from '@/hooks/use-page-store'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
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
  PlusCircle,
  ShoppingCart,
  FileBarChart,
  Wallet,
  Users,
  CircleDot,
} from 'lucide-react'
import { motion } from 'framer-motion'

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

// ── Animation variants ──
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

// ── P&L mini-bar component ──
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
      />
    </div>
  )
}

// ── Greeting helper ──
function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Selamat Pagi'
  if (h < 15) return 'Selamat Siang'
  if (h < 18) return 'Selamat Sore'
  return 'Selamat Malam'
}

function formatDateNow(): string {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date())
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const { features, isLoading: planLoading } = usePlan()
  const { setCurrentPage } = usePageStore()
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
      <div className="space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 bg-zinc-800 mb-1" />
          <Skeleton className="h-4 w-72 bg-zinc-800" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 bg-zinc-900 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 bg-zinc-900/50 rounded-xl w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-44 bg-zinc-900 rounded-xl col-span-1" />
          <Skeleton className="h-44 bg-zinc-900 rounded-xl col-span-1 lg:col-span-2" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64 bg-zinc-900 rounded-xl" />
          <Skeleton className="h-64 bg-zinc-900 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-5"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ── Welcome Header ── */}
      <motion.div variants={itemVariants} className="space-y-1">
        <h1 className="text-xl font-bold text-zinc-100">
          {getGreeting()}, {session?.user?.name?.split(' ')[0] ?? 'User'} 👋
        </h1>
        <p className="text-sm text-zinc-500">{formatDateNow()}</p>
      </motion.div>

      {/* ═══════════════════════════════════════════════════
          SECTION 1 — Stat Cards Row
      ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Revenue — Gradient Accent */}
        <motion.div variants={itemVariants}>
          <Card className="bg-zinc-900 border-0 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent" />
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-500/10 to-transparent rounded-bl-full" />
            <CardContent className="p-4 relative">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                  Revenue Hari Ini
                </p>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                  <DollarSign className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-emerald-400 tracking-tight">
                {stats ? formatCurrency(stats.todayRevenue) : '-'}
              </p>
              {/* Change badge */}
              <div className="flex items-center gap-1.5 mt-2">
                {stats && stats.yesterdayRevenue > 0 ? (
                  <span
                    className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
                      isUp
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}
                  >
                    {isUp ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {Math.abs(changePercent).toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-[11px] text-zinc-600">vs kemarin</span>
                )}
                <span className="text-[11px] text-zinc-500">
                  {stats ? `${formatNumber(stats.todayTransactions)} trx` : ''}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Today's Transactions */}
        <motion.div variants={itemVariants}>
          <Card className="bg-zinc-900 border border-zinc-800/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                  Transaksi
                </p>
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300">
                  <Receipt className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-zinc-100 tracking-tight">
                {stats ? formatNumber(stats.todayTransactions) : '-'}
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[11px] text-zinc-600">kemarin </span>
                <span className="text-[11px] text-zinc-400 font-medium">
                  {stats ? formatNumber(stats.yesterdayTransactions) : '-'}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Today's Profit — OWNER only */}
        {isOwner && (
          <motion.div variants={itemVariants}>
            <Card className="bg-zinc-900 border border-amber-500/10 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/8 via-amber-500/3 to-transparent" />
              <CardContent className="p-4 relative">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                    Cuan Bersih
                  </p>
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-amber-400 tracking-tight">
                  {stats && stats.todayProfit !== null
                    ? formatCurrency(stats.todayProfit)
                    : '-'}
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-zinc-600">total </span>
                  <span className="text-[11px] text-amber-400/70 font-medium">
                    {stats && stats.totalProfit !== null
                      ? formatCurrency(stats.totalProfit)
                      : '-'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Low Stock — with pulse animation */}
        <motion.div variants={itemVariants}>
          <Card
            className={`bg-zinc-900 border ${
              stats && stats.lowStockProducts > 0
                ? 'border-red-500/20'
                : 'border-zinc-800/60'
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                  Stok Menipis
                </p>
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    stats && stats.lowStockProducts > 0
                      ? 'bg-red-500/15 text-red-400'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <p
                  className={`text-2xl font-bold tracking-tight ${
                    stats && stats.lowStockProducts > 0
                      ? 'text-red-400'
                      : 'text-zinc-100'
                  }`}
                >
                  {stats ? formatNumber(stats.lowStockProducts) : '-'}
                </p>
                {stats && stats.lowStockProducts > 0 && (
                  <motion.span
                    className="relative flex h-2.5 w-2.5"
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-40" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                  </motion.span>
                )}
              </div>
              <div className="mt-2">
                <span className="text-[11px] text-zinc-500">
                  {stats && stats.lowStockProducts > 0
                    ? `${stats.lowStockProducts} produk perlu restock`
                    : 'Semua stok aman'}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Quick Actions ── */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Button
            variant="outline"
            className="h-auto py-3.5 sm:py-3 px-4 bg-zinc-900 border-zinc-800/60 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100 transition-all rounded-xl gap-2.5 justify-center"
            onClick={() => setCurrentPage('products')}
          >
            <PlusCircle className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-medium">Add Product</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-3.5 sm:py-3 px-4 bg-zinc-900 border-zinc-800/60 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100 transition-all rounded-xl gap-2.5 justify-center"
            onClick={() => setCurrentPage('pos')}
          >
            <ShoppingCart className="h-4 w-4 text-blue-400" />
            <span className="text-xs font-medium">New Transaction</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-3.5 sm:py-3 px-4 bg-zinc-900 border-zinc-800/60 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100 transition-all rounded-xl gap-2.5 justify-center"
            onClick={() => setCurrentPage('transactions')}
          >
            <FileBarChart className="h-4 w-4 text-violet-400" />
            <span className="text-xs font-medium">View Reports</span>
          </Button>
        </div>
      </motion.div>

      {/* ── All-time stats — compact grid ── */}
      <motion.div variants={itemVariants}>
        <div className="bg-zinc-900/60 border border-zinc-800/40 rounded-xl p-3">
          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-2.5">Statistik Keseluruhan</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700/30">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Wallet className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-zinc-500 leading-tight">Total Revenue</p>
                <p className="text-sm font-bold text-zinc-100 truncate">
                  {stats ? formatCurrency(stats.totalRevenue) : '-'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700/30">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <Receipt className="h-4 w-4 text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-zinc-500 leading-tight">Total Transaksi</p>
                <p className="text-sm font-bold text-zinc-100">
                  {stats ? formatNumber(stats.totalTransactions) : '-'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700/30">
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                <Package className="h-4 w-4 text-violet-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-zinc-500 leading-tight">Total Produk</p>
                <p className="text-sm font-bold text-zinc-100">
                  {stats ? formatNumber(stats.totalProducts) : '-'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700/30">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-zinc-500 leading-tight">Top Customers</p>
                <p className="text-sm font-bold text-zinc-100">
                  {stats?.topCustomers?.length ?? 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════
          SECTION 2 — P&L Preview (OWNER only)
      ═══════════════════════════════════════════════════ */}
      {isOwner && (
        <motion.div variants={itemVariants}>
          <Card className="bg-zinc-900 border border-zinc-800/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-zinc-200">
                  Laba & Rugi Hari Ini
                </h2>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/40 p-3 space-y-2">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
                    Brutto
                  </p>
                  <p className="text-base font-bold text-zinc-200">
                    {stats ? formatCurrency(stats.todayBrutto) : '-'}
                  </p>
                  <MiniBar value={stats?.todayBrutto ?? 0} max={stats?.todayBrutto ?? 1} color="bg-zinc-400" />
                </div>
                <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/40 p-3 space-y-2">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
                    Diskon
                  </p>
                  <p className="text-base font-bold text-red-400">
                    {stats ? `- ${formatCurrency(stats.todayDiscount)}` : '-'}
                  </p>
                  <MiniBar value={stats?.todayDiscount ?? 0} max={stats?.todayBrutto ?? 1} color="bg-red-400" />
                </div>
                <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/40 p-3 space-y-2">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
                    Netto
                  </p>
                  <p className="text-base font-bold text-emerald-400">
                    {stats ? formatCurrency(stats.todayRevenue) : '-'}
                  </p>
                  <MiniBar value={stats?.todayRevenue ?? 0} max={stats?.todayBrutto ?? 1} color="bg-emerald-400" />
                </div>
                <div className="rounded-xl bg-amber-500/5 border border-amber-500/15 p-3 space-y-2">
                  <p className="text-[10px] text-amber-500/70 uppercase tracking-wider font-medium">
                    Profit
                  </p>
                  <p className="text-base font-bold text-amber-400">
                    {stats && stats.todayProfit !== null
                      ? formatCurrency(stats.todayProfit)
                      : '-'}
                  </p>
                  <MiniBar value={stats?.todayProfit ?? 0} max={stats?.todayBrutto ?? 1} color="bg-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════
          SECTION 3 — Peak Hours + AI Insight Row (OWNER only)
      ═══════════════════════════════════════════════════ */}
      {isOwner && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Peak Hours Chart — Pro-gated */}
          <motion.div variants={itemVariants} className="lg:col-span-3">
            <Card className="bg-zinc-900 border border-zinc-800/60 h-full">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-violet-400" />
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
                  <div className="h-28 sm:h-36 flex flex-col items-center justify-center text-center rounded-xl bg-zinc-800/30 border border-zinc-700/30">
                    <Crown className="h-8 w-8 text-amber-400/40 mb-2" />
                    <p className="text-xs text-zinc-400 font-medium">
                      Upgrade ke Pro untuk Peak Hours
                    </p>
                    <p className="text-[11px] text-zinc-600 mt-0.5">
                      Analisa jam tersibuk untuk optimasi shift karyawan
                    </p>
                  </div>
                ) : (
                  <div className="relative h-28 sm:h-36">
                    {/* Y-axis label */}
                    <div className="absolute left-0 top-0 bottom-6 w-7 flex flex-col justify-between text-[10px] text-zinc-600">
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
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 shadow-lg">
                              <p className="text-zinc-300 font-medium">
                                {String(bucket.hour).padStart(2, '0')}:00 —{' '}
                                {bucket.transactionCount} trx
                              </p>
                              <p className="text-emerald-400">
                                {formatCurrency(bucket.revenue)}
                              </p>
                            </div>
                            <motion.div
                              className={`w-full rounded-t transition-colors duration-150 ${
                                isPeak
                                  ? 'bg-gradient-to-t from-violet-600 to-violet-400'
                                  : bucket.transactionCount > 0
                                    ? 'bg-emerald-500/50 hover:bg-emerald-400/70'
                                    : 'bg-zinc-800/80'
                              }`}
                              initial={{ height: 0 }}
                              animate={{ height: `${Math.max(heightPct, 2)}%` }}
                              transition={{ duration: 0.6, ease: 'easeOut' }}
                            />
                            {/* Hour labels (show every 3h) */}
                            {bucket.hour % 3 === 0 && (
                              <span className="text-[9px] text-zinc-600 -mt-0.5">
                                {String(bucket.hour).padStart(2, '0')}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {/* X-axis line */}
                    <div className="ml-9 mt-0 h-px bg-zinc-800" />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* AI Insight — Pro-gated */}
          <motion.div variants={itemVariants} className="lg:col-span-2">
            <Card className="bg-zinc-900 border border-zinc-800/60 h-full">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-400" />
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
                  <div className="flex flex-col items-center justify-center h-28 text-center rounded-xl bg-zinc-800/30 border border-zinc-700/30">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 mb-2">
                      <Sparkles className="h-5 w-5 text-amber-400/50" />
                    </div>
                    <p className="text-xs text-zinc-400 font-medium">
                      Upgrade ke Pro untuk AI Insight
                    </p>
                    <p className="text-[11px] text-zinc-600 mt-0.5">
                      Rekomendasi cerdas berbasis data penjualan
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-xl bg-gradient-to-br from-amber-500/5 via-transparent to-violet-500/5 border border-amber-500/10 p-4 h-28">
                    <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="h-4.5 w-4.5 text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {stats?.aiInsight ?? 'Memuat insight...'}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          SECTION 4 — Top Customers + Low Stock Tables
      ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Customers */}
        <motion.div variants={itemVariants}>
          <Card className="bg-zinc-900 border border-zinc-800/60">
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                Top Customers
              </h2>
              {(!stats?.topCustomers || stats.topCustomers.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Users className="h-8 w-8 text-zinc-700 mb-2" />
                  <p className="text-xs text-zinc-500">Belum ada customer</p>
                </div>
              ) : (
                <>
                  {/* Mobile: compact card list */}
                  <div className="flex flex-col gap-2 md:hidden">
                    {stats.topCustomers.slice(0, 5).map((c, idx) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-3 rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3"
                      >
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <span className="text-[11px] font-bold text-emerald-400">{idx + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-zinc-200 font-medium truncate">{c.name}</p>
                          <p className="text-[10px] text-zinc-500 truncate">{c.whatsapp}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-zinc-200 font-semibold">{formatCurrency(c.totalSpend)}</p>
                          <Badge className="bg-amber-500/10 border-amber-500/20 text-amber-400 text-[10px] mt-0.5">
                            {c.points} pts
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop: full table */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-zinc-800/60 hover:bg-transparent">
                          <TableHead className="text-zinc-500 text-[11px] w-8 py-2.5">#</TableHead>
                          <TableHead className="text-zinc-500 text-[11px] py-2.5">Nama</TableHead>
                          <TableHead className="text-zinc-500 text-[11px] text-right py-2.5">
                            Total Spend
                          </TableHead>
                          <TableHead className="text-zinc-500 text-[11px] text-center py-2.5">
                            Poin
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats.topCustomers.slice(0, 5).map((c, idx) => (
                          <TableRow
                            key={c.id}
                            className="border-zinc-800/40 hover:bg-zinc-800/30"
                          >
                            <TableCell className="text-[11px] text-zinc-500 font-mono py-2.5">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="py-2.5">
                              <div>
                                <p className="text-xs text-zinc-200 font-medium">
                                  {c.name}
                                </p>
                                <p className="text-[10px] text-zinc-500">
                                  {c.whatsapp}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-zinc-200 text-right font-semibold py-2.5">
                              {formatCurrency(c.totalSpend)}
                            </TableCell>
                            <TableCell className="text-center py-2.5">
                              <Badge className="bg-amber-500/10 border-amber-500/20 text-amber-400 text-[10px]">
                                {c.points} pts
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Low Stock Products */}
        <motion.div variants={itemVariants}>
          <Card className="bg-zinc-900 border border-zinc-800/60">
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                Produk Stok Menipis
              </h2>
              {(!stats?.lowStockList || stats.lowStockList.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Package className="h-8 w-8 text-emerald-500/30 mb-2" />
                  <p className="text-xs text-zinc-500">Semua stok aman</p>
                </div>
              ) : (
                <>
                  {/* Mobile: compact card list */}
                  <div className="flex flex-col gap-2 md:hidden">
                    {stats.lowStockList.map((p, idx) => {
                      const isCritical = p.stock === 0
                      const isWarning = p.stock > 0 && p.stock <= p.lowStockAlert / 2
                      return (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-zinc-200 font-medium truncate">{p.name}</p>
                            <p className="text-[10px] text-zinc-500">Stok: {p.lowStockAlert} alert</p>
                          </div>
                          <div className="text-right shrink-0 flex items-center gap-2">
                            <span
                              className={`text-sm font-bold ${
                                isCritical
                                  ? 'text-red-400'
                                  : isWarning
                                    ? 'text-amber-400'
                                    : 'text-yellow-300'
                              }`}
                            >
                              {p.stock}
                            </span>
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
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* Desktop: full table */}
                  <div className="hidden md:block overflow-x-auto max-h-60 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-zinc-800/60 hover:bg-transparent sticky top-0 bg-zinc-900 z-10">
                          <TableHead className="text-zinc-500 text-[11px] w-8 py-2.5">#</TableHead>
                          <TableHead className="text-zinc-500 text-[11px] py-2.5">
                            Produk
                          </TableHead>
                          <TableHead className="text-zinc-500 text-[11px] text-right py-2.5">
                            Stok
                          </TableHead>
                          <TableHead className="text-zinc-500 text-[11px] text-right py-2.5">
                            Alert
                          </TableHead>
                          <TableHead className="text-zinc-500 text-[11px] text-center py-2.5">
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
                              className="border-zinc-800/40 hover:bg-zinc-800/30"
                            >
                              <TableCell className="text-[11px] text-zinc-500 font-mono py-2.5">
                                {idx + 1}
                              </TableCell>
                              <TableCell className="text-xs text-zinc-200 font-medium py-2.5">
                                {p.name}
                              </TableCell>
                              <TableCell
                                className={`text-xs text-right font-bold py-2.5 ${
                                  isCritical
                                    ? 'text-red-400'
                                    : isWarning
                                      ? 'text-amber-400'
                                      : 'text-yellow-300'
                                }`}
                              >
                                {p.stock}
                              </TableCell>
                              <TableCell className="text-xs text-zinc-500 text-right py-2.5">
                                {p.lowStockAlert}
                              </TableCell>
                              <TableCell className="text-center py-2.5">
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
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Safe area bottom spacer for mobile */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </motion.div>
  )
}
