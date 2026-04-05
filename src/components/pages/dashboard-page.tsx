'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { formatCurrency, formatNumber } from '@/lib/format'
import { usePlan } from '@/hooks/use-plan'
import { usePageStore } from '@/hooks/use-page-store'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DollarSign,
  Receipt,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Crown,
  Zap,
  PlusCircle,
  ShoppingCart,
  FileBarChart,
  Package,
  Users,
  RefreshCw,
  Sparkles,
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
  todayTax: number
  todayTransactions: number
  todayProfit: number | null
  yesterdayRevenue: number
  yesterdayTransactions: number
  revenueChangePercent: number
  peakHours: HourBucket[] | null
  aiInsight: string | null
}

interface InsightItem {
  id: string
  title: string
  why: string
  actions: string[]
  priority: 'critical' | 'high' | 'medium' | 'low'
  score: number
  cta: { label: string; page: string }[]
  emoji: string
}

interface InsightEngineData {
  insights: InsightItem[]
  topInsight: InsightItem | null
  healthScore: number
  summary: string
  metrics: {
    todayRevenue: number
    todayBrutto: number
    todayDiscount: number
    todayTax: number
    todayTransactions: number
    todayProfit: number | null
    todayAOV: number
    yesterdayRevenue: number
    yesterdayTransactions: number
    totalProducts: number
    lowStockCount: number
    outOfStockCount: number
    totalCustomers: number
    newCustomersThisWeek: number
    topSelling: { name: string; qty: number; revenue: number }[]
    lowStockProducts: { name: string; stock: number; lowStockAlert: number }[]
  }
  generatedAt: string
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

// ── Health Score Ring ──
function HealthRing({ score }: { score: number }) {
  const radius = 32
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color =
    score >= 75 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400'
  const ringColor =
    score >= 75 ? 'stroke-emerald-400' : score >= 50 ? 'stroke-amber-400' : 'stroke-red-400'
  const bgColor =
    score >= 75
      ? 'border-emerald-500/20'
      : score >= 50
        ? 'border-amber-500/20'
        : 'border-red-500/20'

  return (
    <div className={`relative w-16 h-16 border ${bgColor} rounded-full flex items-center justify-center bg-zinc-900/80`}>
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 72 72">
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-zinc-800"
          strokeWidth="4"
        />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          className={ringColor}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <div className="flex flex-col items-center justify-center z-10">
        <span className={`text-sm font-bold leading-none ${color}`}>{score}</span>
        <span className="text-[8px] text-zinc-500 leading-none">/100</span>
      </div>
    </div>
  )
}

// ── Priority indicator helpers ──
function PriorityDot({ priority }: { priority: InsightItem['priority'] }) {
  const map = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '✅',
  }
  return <span>{map[priority]}</span>
}

function getPriorityBadgeClass(priority: InsightItem['priority']): string {
  switch (priority) {
    case 'critical':
      return 'bg-red-500/10 border-red-500/20 text-red-400'
    case 'high':
      return 'bg-orange-500/10 border-orange-500/20 text-orange-400'
    case 'medium':
      return 'bg-amber-500/10 border-amber-500/20 text-amber-400'
    case 'low':
      return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
  }
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

// ════════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const { data: session } = useSession()
  const { plan, features, isLoading: planLoading } = usePlan()
  const { setCurrentPage } = usePageStore()
  const isOwner = session?.user?.role === 'OWNER'
  const isPro = features?.apiAccess === true

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // AI Insight Engine state (OWNER only)
  const [insightData, setInsightData] = useState<InsightEngineData | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [insightError, setInsightError] = useState<string | null>(null)

  // ── Fetchers ──
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

  const fetchInsights = useCallback(async () => {
    setInsightLoading(true)
    setInsightError(null)
    try {
      const res = await fetch('/api/insights/engine')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Gagal memuat insight')
      }
      const json = await res.json()
      setInsightData(json)
    } catch (e) {
      setInsightError(e instanceof Error ? e.message : 'Terjadi kesalahan')
    } finally {
      setInsightLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    if (isOwner) fetchInsights()
  }, [isOwner, fetchInsights])

  useEffect(() => {
    intervalRef.current = setInterval(fetchStats, POLL_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchStats])

  // ── Derived ──
  const changePercent = stats?.revenueChangePercent ?? 0
  const isUp = changePercent >= 0
  const busiestHour = stats?.peakHours?.reduce(
    (max, b) => (b.transactionCount > max.transactionCount ? b : max),
    { hour: 0, transactionCount: 0, revenue: 0 }
  )
  const maxTxCount = stats?.peakHours
    ? Math.max(...stats.peakHours.map((b) => b.transactionCount), 1)
    : 1

  // Use insight engine topSelling if available, fallback to empty
  const topSelling = insightData?.metrics.topSelling ?? []
  const otherInsights = insightData?.insights.filter(
    (i) => i.id !== insightData.topInsight?.id
  ) ?? []

  // ── Loading Skeleton ──
  if (loading) {
    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 bg-zinc-800 mb-1" />
          <Skeleton className="h-4 w-72 bg-zinc-800" />
        </div>
        {isOwner && <Skeleton className="h-72 bg-zinc-900 rounded-xl" />}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 bg-zinc-900 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 bg-zinc-900/50 rounded-xl w-full" />
        {isOwner && <Skeleton className="h-32 bg-zinc-900 rounded-xl" />}
        {isOwner && <Skeleton className="h-44 bg-zinc-900 rounded-xl" />}
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
      {/* ═══════════════════════════════════════════════════
          1. Welcome Header
      ═══════════════════════════════════════════════════ */}
      <motion.div variants={itemVariants} className="space-y-1">
        <h1 className="text-xl font-bold text-zinc-100">
          {getGreeting()}, {session?.user?.name?.split(' ')[0] ?? 'User'} 👋
        </h1>
        <p className="text-sm text-zinc-500">{formatDateNow()}</p>
      </motion.div>

      {/* ═══════════════════════════════════════════════════
          2. AI Insight Card (OWNER only) — HERO SECTION
      ═══════════════════════════════════════════════════ */}
      {isOwner && (
        <motion.div variants={itemVariants}>
          {insightLoading && !insightData ? (
            <Card className="bg-zinc-900 border border-zinc-800/60">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-5 rounded bg-zinc-800" />
                    <Skeleton className="h-4 w-36 bg-zinc-800" />
                  </div>
                  <Skeleton className="h-10 w-10 rounded-full bg-zinc-800" />
                </div>
                <Skeleton className="h-5 w-64 bg-zinc-800" />
                <Skeleton className="h-3 w-full bg-zinc-800" />
                <Skeleton className="h-3 w-80 bg-zinc-800" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-28 rounded-lg bg-zinc-800" />
                  <Skeleton className="h-8 w-28 rounded-lg bg-zinc-800" />
                </div>
                <div className="flex gap-2 pt-2 border-t border-zinc-800">
                  <Skeleton className="h-6 w-32 rounded-full bg-zinc-800" />
                  <Skeleton className="h-6 w-36 rounded-full bg-zinc-800" />
                </div>
              </CardContent>
            </Card>
          ) : insightError && !insightData ? (
            <Card className="bg-zinc-900 border border-red-500/20">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-400">Gagal memuat insight</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{insightError}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchInsights}
                    className="text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : insightData ? (
            <Card className="bg-zinc-900 border border-zinc-800/60 overflow-hidden relative">
              {/* Subtle gradient overlay based on health */}
              <div
                className={`absolute inset-0 pointer-events-none ${
                  insightData.healthScore >= 75
                    ? 'bg-gradient-to-br from-emerald-500/[0.04] to-transparent'
                    : insightData.healthScore >= 50
                      ? 'bg-gradient-to-br from-amber-500/[0.04] to-transparent'
                      : 'bg-gradient-to-br from-red-500/[0.04] to-transparent'
                }`}
              />
              <CardContent className="p-5 relative">
                {/* Header row */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-violet-400" />
                    <h2 className="text-sm font-semibold text-zinc-200">
                      💡 Insight Hari Ini
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={fetchInsights}
                      disabled={insightLoading}
                      className="h-7 text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 gap-1"
                    >
                      <RefreshCw className={`h-3 w-3 ${insightLoading ? 'animate-spin' : ''}`} />
                    </Button>
                    <HealthRing score={insightData.healthScore} />
                  </div>
                </div>

                {/* Top Insight */}
                {insightData.topInsight ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <PriorityDot priority={insightData.topInsight.priority} />
                      <h3 className="text-base font-semibold text-zinc-100">
                        {insightData.topInsight.emoji} {insightData.topInsight.title}
                      </h3>
                    </div>

                    {/* Why section */}
                    <div>
                      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                        Kenapa:
                      </p>
                      <p className="text-sm text-zinc-300 leading-relaxed">
                        {insightData.topInsight.why}
                      </p>
                    </div>

                    {/* Recommended actions */}
                    {insightData.topInsight.actions.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                          Rekomendasi:
                        </p>
                        <ul className="space-y-1">
                          {insightData.topInsight.actions.map((action, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                              <span className="text-violet-400 mt-0.5 shrink-0">•</span>
                              {action}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* CTA buttons */}
                    {insightData.topInsight.cta.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {insightData.topInsight.cta.map((cta, i) => (
                          <Button
                            key={i}
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs font-medium bg-zinc-800 border-zinc-700/60 hover:bg-zinc-700 hover:border-zinc-600 text-zinc-200 rounded-lg gap-1.5"
                            onClick={() => setCurrentPage(cta.page as 'pos' | 'products' | 'transactions' | 'customers' | 'settings' | 'crew' | 'dashboard' | 'audit-log')}
                          >
                            {cta.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-zinc-400">Semua berjalan baik! Tidak ada insight penting saat ini.</p>
                  </div>
                )}

                {/* Other insight badges */}
                {otherInsights.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-zinc-800">
                    {otherInsights.slice(0, 4).map((insight) => (
                      <button
                        key={insight.id}
                        onClick={() => {
                          setInsightData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  topInsight: insight,
                                  insights: prev.insights,
                                }
                              : null
                          )
                        }}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-pointer transition-colors hover:bg-zinc-800 ${getPriorityBadgeClass(insight.priority)}`}
                      >
                        <PriorityDot priority={insight.priority} />
                        <span className="max-w-[160px] truncate">{insight.emoji} {insight.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════
          3. Plan Upgrade Card (FREE only, compact)
      ═══════════════════════════════════════════════════ */}
      {!planLoading && plan?.type === 'free' && (
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/40">
            <p className="text-xs text-zinc-400">
              Kamu menggunakan paket <span className="font-medium text-zinc-300">Free</span> — upgrade untuk fitur lengkap
            </p>
            <Button
              size="sm"
              className="shrink-0 bg-emerald-500/90 hover:bg-emerald-500 text-white text-xs font-medium h-7 px-3 rounded-lg gap-1.5"
              onClick={() => setCurrentPage('settings')}
            >
              <Crown className="h-3 w-3" />
              Upgrade
            </Button>
          </div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════
          4. Stat Cards Grid
      ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue Hari Ini — emerald gradient */}
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

        {/* Transaksi */}
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

        {/* Cuan Bersih — OWNER only */}
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

        {/* Stok Menipis — with pulse */}
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

      {/* ═══════════════════════════════════════════════════
          5. Quick Actions
      ═══════════════════════════════════════════════════ */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-3 gap-3">
          <Button
            variant="outline"
            className="h-auto py-3 px-3 bg-zinc-900 border-zinc-800/60 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100 transition-all rounded-xl gap-2 justify-center"
            onClick={() => setCurrentPage('products')}
          >
            <PlusCircle className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-medium">Add Product</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-3 px-3 bg-zinc-900 border-zinc-800/60 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100 transition-all rounded-xl gap-2 justify-center"
            onClick={() => setCurrentPage('pos')}
          >
            <ShoppingCart className="h-4 w-4 text-blue-400" />
            <span className="text-xs font-medium">New Transaction</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-3 px-3 bg-zinc-900 border-zinc-800/60 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100 transition-all rounded-xl gap-2 justify-center"
            onClick={() => setCurrentPage('transactions')}
          >
            <FileBarChart className="h-4 w-4 text-violet-400" />
            <span className="text-xs font-medium">View Reports</span>
          </Button>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════
          6. P&L Preview (OWNER only)
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
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Brutto */}
                <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/40 p-3 space-y-2">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
                    Brutto
                  </p>
                  <p className="text-base font-bold text-zinc-200">
                    {stats ? formatCurrency(stats.todayBrutto) : '-'}
                  </p>
                  <MiniBar value={stats?.todayBrutto ?? 0} max={stats?.todayBrutto ?? 1} color="bg-zinc-400" />
                </div>
                {/* Diskon */}
                <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/40 p-3 space-y-2">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
                    Diskon
                  </p>
                  <p className="text-base font-bold text-red-400">
                    {stats ? `- ${formatCurrency(stats.todayDiscount)}` : '-'}
                  </p>
                  <MiniBar value={stats?.todayDiscount ?? 0} max={stats?.todayBrutto ?? 1} color="bg-red-400" />
                </div>
                {/* Netto */}
                <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/40 p-3 space-y-2">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
                    Netto
                  </p>
                  <p className="text-base font-bold text-emerald-400">
                    {stats ? formatCurrency(stats.todayRevenue) : '-'}
                  </p>
                  <MiniBar value={stats?.todayRevenue ?? 0} max={stats?.todayBrutto ?? 1} color="bg-emerald-400" />
                </div>
                {/* PPN */}
                <div className="rounded-xl bg-sky-500/[0.04] border border-sky-500/15 p-3 space-y-2">
                  <p className="text-[10px] text-sky-400/70 uppercase tracking-wider font-medium">
                    PPN
                  </p>
                  <p className="text-base font-bold text-sky-400">
                    {stats ? formatCurrency(stats.todayTax) : '-'}
                  </p>
                  <MiniBar value={stats?.todayTax ?? 0} max={stats?.todayBrutto ?? 1} color="bg-sky-400" />
                </div>
                {/* Profit */}
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
          7. Peak Hours (OWNER only, Pro feature)
      ═══════════════════════════════════════════════════ */}
      {isOwner && (
        <motion.div variants={itemVariants}>
          <Card className="bg-zinc-900 border border-zinc-800/60">
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
      )}

      {/* ═══════════════════════════════════════════════════
          8. Bottom Row — Top Products & Top Customers
      ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 5 Products */}
        <motion.div variants={itemVariants}>
          <Card className="bg-zinc-900 border border-zinc-800/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-zinc-200">
                  Produk Terlaris
                </h2>
              </div>
              {topSelling.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Package className="h-8 w-8 text-zinc-700 mb-2" />
                  <p className="text-xs text-zinc-500">Belum ada data penjualan hari ini</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {topSelling.slice(0, 5).map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-800/40 border border-zinc-700/30"
                    >
                      <span className="text-[11px] font-bold text-zinc-600 w-4 text-center shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-zinc-200 truncate">{p.name}</p>
                        <p className="text-[10px] text-zinc-500">{formatNumber(p.qty)} terjual</p>
                      </div>
                      <p className="text-xs font-semibold text-emerald-400 shrink-0">
                        {formatCurrency(p.revenue)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Top 5 Customers */}
        <motion.div variants={itemVariants}>
          <Card className="bg-zinc-900 border border-zinc-800/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-violet-400" />
                <h2 className="text-sm font-semibold text-zinc-200">
                  Pelanggan Terbaik
                </h2>
              </div>
              {(!stats?.topCustomers || stats.topCustomers.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Users className="h-8 w-8 text-zinc-700 mb-2" />
                  <p className="text-xs text-zinc-500">Belum ada data pelanggan</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {stats.topCustomers.slice(0, 5).map((c, idx) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-800/40 border border-zinc-700/30"
                    >
                      <span className="text-[11px] font-bold text-zinc-600 w-4 text-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-zinc-200 truncate">{c.name}</p>
                        <p className="text-[10px] text-zinc-500">{formatNumber(c.points)} poin</p>
                      </div>
                      <p className="text-xs font-semibold text-violet-400 shrink-0">
                        {formatCurrency(c.totalSpend)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}
