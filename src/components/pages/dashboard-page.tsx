'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { formatCurrency, formatNumber } from '@/lib/format'
import { usePlan } from '@/hooks/use-plan'
import { usePageStore } from '@/hooks/use-page-store'
import { useTimezone } from '@/hooks/use-timezone'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Lock,
  TrendingDown,
  Minus,
  Activity,
  ShoppingCartIcon,
  Clock,
  Warehouse,
  Target,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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

interface ForecastData {
  trend: { date: string; revenue: number; txCount: number }[]
  forecast: { date: string; predictedRevenue: number; isForecast: boolean }[]
  trendDirection: 'up' | 'down' | 'stable'
  stockPredictions: {
    name: string
    stock: number
    lowStockAlert: number
    sold14Days: number
    dailyVelocity: number
    daysUntilEmpty: number
    daysUntilLow: number
    status: 'critical' | 'warning' | 'ok'
  }[]
  dayPerformance: { day: string; dayOfWeek: number; avgRevenue: number; totalTx: number; avgTx: number }[]
  summary: {
    weekOverWeek: number
    avgDailyRevenue: number
    projectedMonthly: number
    projectedWeekly: number
    criticalStock: number
    warningStock: number
  }
  generatedAt: string
}

const POLL_INTERVAL = 30_000

// ── Animation variants ──
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

// ── Helpers ──
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

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

// ── Sub-Components ──

function HealthRing({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' }) {
  const radius = size === 'sm' ? 18 : 32
  const svgSize = size === 'sm' ? 44 : 72
  const sw = size === 'sm' ? 3 : 4
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
    <div className={`relative ${size === 'sm' ? 'w-11 h-11' : 'w-16 h-16'} border ${bgColor} rounded-full flex items-center justify-center bg-zinc-900/80`}>
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox={`0 0 ${svgSize} ${svgSize}`}>
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-zinc-800"
          strokeWidth={sw}
        />
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          className={ringColor}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <span className={`font-bold leading-none z-10 ${size === 'sm' ? 'text-xs' : 'text-sm'} ${color}`}>
        {score}
      </span>
    </div>
  )
}

function PriorityDot({ priority }: { priority: InsightItem['priority'] }) {
  const map: Record<string, string> = { critical: '🔴', high: '🟠', medium: '🟡', low: '✅' }
  return <span className="shrink-0">{map[priority]}</span>
}

function getPriorityColor(priority: InsightItem['priority']): string {
  switch (priority) {
    case 'critical': return 'text-red-400'
    case 'high': return 'text-orange-400'
    case 'medium': return 'text-amber-400'
    case 'low': return 'text-emerald-400'
  }
}

function getPriorityBg(priority: InsightItem['priority']): string {
  switch (priority) {
    case 'critical': return 'bg-red-500/8 border-red-500/15'
    case 'high': return 'bg-orange-500/8 border-orange-500/15'
    case 'medium': return 'bg-amber-500/8 border-amber-500/15'
    case 'low': return 'bg-emerald-500/8 border-emerald-500/15'
  }
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
      />
    </div>
  )
}

function ProLock({ label = 'PRO' }: { label?: string }) {
  return (
    <Badge className="bg-amber-500/10 border-amber-500/20 text-amber-400 text-[10px] gap-1 shrink-0">
      <Crown className="h-3 w-3" />
      {label}
    </Badge>
  )
}

function TrendIcon({ direction }: { direction: 'up' | 'down' | 'stable' }) {
  if (direction === 'up') return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
  if (direction === 'down') return <TrendingDown className="h-3.5 w-3.5 text-red-400" />
  return <Minus className="h-3.5 w-3.5 text-zinc-400" />
}

// ── Sparkline mini-chart ──
function Sparkline({ data, color = 'text-emerald-400', height = 40 }: { data: number[]; color?: string; height?: number }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const w = data.length * 8
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={w} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={color}
      />
    </svg>
  )
}

// ── Revenue Trend Line Chart ──
function RevenueLineChart({ trend, forecast, onReady }: {
  trend: { date: string; revenue: number }[]
  forecast: { date: string; predictedRevenue: number; isForecast: boolean }[]
  onReady?: () => void
}) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartW = 600
  const chartH = 160
  const pad = { top: 8, right: 8, bottom: 24, left: 8 }
  const innerW = chartW - pad.left - pad.right
  const innerH = chartH - pad.top - pad.bottom

  const allValues = [...trend.map((d) => d.revenue), ...forecast.map((d) => d.predictedRevenue)]
  const maxVal = Math.max(...allValues, 1)
  const minVal = Math.min(...allValues, 0)
  const range = maxVal - minVal || 1

  const allPoints = [...trend.map((d) => ({ x: d.date, y: d.revenue, isForecast: false })), ...forecast.map((d) => ({ x: d.date, y: d.predictedRevenue, isForecast: true }))]
  const totalPts = allPoints.length

  const toX = (i: number) => pad.left + (i / (totalPts - 1)) * innerW
  const toY = (v: number) => pad.top + innerH - ((v - minVal) / range) * innerH

  const actualPath = trend.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.revenue).toFixed(1)}`).join(' ')
  const forecastPath = forecast.map((d, i) => {
    const idx = trend.length + i
    if (i === 0) {
      const lastTrend = trend[trend.length - 1]
      return `M${toX(trend.length - 1).toFixed(1)},${toY(lastTrend.revenue).toFixed(1)} L${toX(idx).toFixed(1)},${toY(d.predictedRevenue).toFixed(1)}`
    }
    return `L${toX(idx).toFixed(1)},${toY(d.predictedRevenue).toFixed(1)}`
  }).join(' ')

  // Area fill paths
  const actualArea = `${actualPath} L${toX(trend.length - 1).toFixed(1)},${(pad.top + innerH).toFixed(1)} L${toX(0).toFixed(1)},${(pad.top + innerH).toFixed(1)} Z`
  const forecastArea = (() => {
    const lastTrendX = toX(trend.length - 1).toFixed(1)
    const lastForecastX = toX(totalPts - 1).toFixed(1)
    const baseY = (pad.top + innerH).toFixed(1)
    const pts = forecast.map((d, i) => {
      const idx = trend.length + i
      return `${toX(idx).toFixed(1)},${toY(d.predictedRevenue).toFixed(1)}`
    }).join(' ')
    return `M${lastTrendX},${baseY} L${lastTrendX},${toY(trend[trend.length - 1].revenue).toFixed(1)} L${pts} L${lastForecastX},${baseY} Z`
  })()

  return (
    <div ref={chartRef} className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full min-w-[500px]" preserveAspectRatio="xMidYMid meet">
        {/* Area fills */}
        <path d={actualArea} fill="url(#actualGrad)" />
        <path d={forecastArea} fill="url(#forecastGrad)" />
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = pad.top + innerH * (1 - pct)
          return <line key={pct} x1={pad.left} y1={y} x2={chartW - pad.right} y2={y} stroke="rgb(63 63 70)" strokeWidth={0.5} />
        })}
        {/* Actual line */}
        <motion.path
          d={actualPath}
          fill="none"
          stroke="rgb(52 211 153)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
        {/* Forecast line (dashed) */}
        <motion.path
          d={forecastPath}
          fill="none"
          stroke="rgb(167 139 250)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="6 4"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: 0.6, ease: 'easeOut' }}
        />
        {/* Dots on actual */}
        {trend.map((d, i) => (
          <motion.circle
            key={`a-${i}`}
            cx={toX(i)} cy={toY(d.revenue)}
            r={i % 3 === 0 ? 3 : 0}
            fill="rgb(52 211 153)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 + i * 0.03 }}
          />
        ))}
        {/* Dots on forecast */}
        {forecast.map((d, i) => {
          const idx = trend.length + i
          return (
            <motion.circle
              key={`f-${i}`}
              cx={toX(idx)} cy={toY(d.predictedRevenue)}
              r={i % 2 === 0 ? 3 : 0}
              fill="rgb(167 139 250)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 + i * 0.03 }}
            />
          )
        })}
        {/* X-axis labels */}
        {allPoints.filter((_, i) => i % 3 === 0).map((p, i) => (
          <text
            key={i}
            x={toX(i * 3)} y={chartH - 4}
            textAnchor="middle"
            className="fill-zinc-600"
            style={{ fontSize: '9px' }}
          >
            {formatShortDate(p.x)}
          </text>
        ))}
        {/* Gradients */}
        <defs>
          <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(52 211 153)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="rgb(52 211 153)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(167 139 250)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="rgb(167 139 250)" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

// ── Day Performance Heat Bar ──
function DayHeatBar({ day, avgRevenue, maxRevenue, avgTx }: { day: string; avgRevenue: number; maxRevenue: number; avgTx: number }) {
  const pct = maxRevenue > 0 ? Math.min((avgRevenue / maxRevenue) * 100, 100) : 0
  const today = new Date().getDay()
  const dayIndex = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].indexOf(day)
  const isToday = dayIndex === today
  const intensity = pct > 80 ? 'from-emerald-500/40 to-emerald-400/20' : pct > 50 ? 'from-emerald-500/25 to-emerald-400/10' : 'from-zinc-600/20 to-zinc-500/10'

  return (
    <div className="flex items-center gap-2 py-1">
      <span className={`text-[11px] w-8 shrink-0 font-medium ${isToday ? 'text-emerald-400' : 'text-zinc-500'}`}>
        {day}
      </span>
      <div className={`flex-1 h-5 rounded-md bg-gradient-to-r ${intensity} border ${isToday ? 'border-emerald-500/30' : 'border-zinc-700/30'} relative overflow-hidden`}>
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-md ${isToday ? 'bg-emerald-500/20' : 'bg-zinc-500/10'}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        <div className="absolute inset-0 flex items-center justify-between px-2">
          <span className="text-[9px] text-zinc-400 font-medium">{formatCurrency(avgRevenue)}</span>
          <span className="text-[9px] text-zinc-500">{avgTx} trx</span>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const { data: session } = useSession()
  const { plan, features, isLoading: planLoading } = usePlan()
  const { setCurrentPage } = usePageStore()
  const { tzOffset } = useTimezone()
  const isOwner = session?.user?.role === 'OWNER'
  const isPro = plan?.type === 'pro' || plan?.type === 'enterprise'
  const hasForecasting = features?.forecasting === true
  const hasAiInsights = features?.aiInsights === true

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Insight Engine state
  const [insightData, setInsightData] = useState<InsightEngineData | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)

  // Forecast state (PRO+)
  const [forecastData, setForecastData] = useState<ForecastData | null>(null)
  const [forecastLoading, setForecastLoading] = useState(false)

  // ── Fetchers ──
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard?tzOffset=${tzOffset}`)
      if (res.ok) setStats(await res.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [tzOffset])

  const fetchInsights = useCallback(async () => {
    setInsightLoading(true)
    try {
      const res = await fetch(`/api/insights/engine?tzOffset=${tzOffset}`)
      if (res.ok) setInsightData(await res.json())
    } catch { /* silent */ }
    finally { setInsightLoading(false) }
  }, [tzOffset])

  const fetchForecast = useCallback(async () => {
    setForecastLoading(true)
    try {
      const res = await fetch(`/api/insights/forecast?tzOffset=${tzOffset}`)
      if (res.ok) setForecastData(await res.json())
    } catch { /* silent */ }
    finally { setForecastLoading(false) }
  }, [tzOffset])

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { if (isOwner && hasAiInsights) fetchInsights() }, [isOwner, hasAiInsights, fetchInsights])
  useEffect(() => { if (isOwner && hasForecasting) fetchForecast() }, [isOwner, hasForecasting, fetchForecast])

  useEffect(() => {
    intervalRef.current = setInterval(fetchStats, POLL_INTERVAL)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
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

  const topSelling = insightData?.metrics.topSelling ?? []
  const otherInsights = insightData?.insights.filter(
    (i) => i.id !== insightData.topInsight?.id
  ) ?? []

  const trendValues = forecastData?.trend.map((d) => d.revenue) ?? []
  const forecastValues = forecastData?.forecast.map((d) => d.predictedRevenue) ?? []

  // ── Loading Skeleton ──
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-52 bg-zinc-800" />
          <Skeleton className="h-3.5 w-64 bg-zinc-800" />
        </div>
        <Skeleton className="h-56 bg-zinc-900 rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 bg-zinc-900 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-52 bg-zinc-900 rounded-2xl" />
          <Skeleton className="h-52 bg-zinc-900 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <motion.div className="space-y-4" variants={containerVariants} initial="hidden" animate="visible">
      {/* ═══════════════════════════════════════════════════
          1. Welcome Header
      ═══════════════════════════════════════════════════ */}
      <motion.div variants={itemVariants} className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
            {getGreeting()}, {session?.user?.name?.split(' ')[0] ?? 'User'}
          </h1>
          <p className="text-sm text-zinc-500">{formatDateNow()}</p>
        </div>
        {isOwner && insightData && (
          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Health Score</p>
              <p className={`text-xs font-semibold ${insightData.healthScore >= 75 ? 'text-emerald-400' : insightData.healthScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                {insightData.healthScore >= 75 ? 'Sehat' : insightData.healthScore >= 50 ? 'Perhatian' : 'Kritis'}
              </p>
            </div>
            <HealthRing score={insightData.healthScore} />
          </div>
        )}
      </motion.div>

      {/* ═══════════════════════════════════════════════════
          2. Upgrade Banner (FREE only)
      ═══════════════════════════════════════════════════ */}
      {!planLoading && plan?.type === 'free' && (
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-500/[0.06] to-emerald-500/[0.06] border border-zinc-800/50">
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-4 w-4 text-violet-400 shrink-0" />
              <p className="text-xs text-zinc-400">
                Buka fitur <span className="font-medium text-zinc-200">Forecasting & Prediksi</span> — upgrade ke Pro atau Enterprise
              </p>
            </div>
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
          3. Stat Cards Grid
      ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Revenue */}
        <motion.div variants={itemVariants}>
          <Card className="bg-zinc-900 border border-zinc-800/60 rounded-xl overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.06] to-transparent" />
            <CardContent className="p-3.5 relative">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Revenue</p>
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <DollarSign className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="text-xl font-bold text-zinc-100 tracking-tight">
                {stats ? formatCurrency(stats.todayRevenue) : '-'}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5">
                {stats && stats.yesterdayRevenue > 0 ? (
                  <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    isUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {isUp ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                    {Math.abs(changePercent).toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-600">vs kemarin</span>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Transaksi */}
        <motion.div variants={itemVariants}>
          <Card className="bg-zinc-900 border border-zinc-800/60 rounded-xl">
            <CardContent className="p-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Transaksi</p>
                <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300">
                  <Receipt className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="text-xl font-bold text-zinc-100 tracking-tight">
                {stats ? formatNumber(stats.todayTransactions) : '-'}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[10px] text-zinc-600">kemarin </span>
                <span className="text-[10px] text-zinc-400 font-medium">
                  {stats ? formatNumber(stats.yesterdayTransactions) : '-'}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Profit — OWNER */}
        {isOwner && (
          <motion.div variants={itemVariants}>
            <Card className="bg-zinc-900 border border-amber-500/10 rounded-xl overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.04] to-transparent" />
              <CardContent className="p-3.5 relative">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Profit</p>
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                    <TrendingUp className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="text-xl font-bold text-amber-400 tracking-tight">
                  {stats && stats.todayProfit !== null ? formatCurrency(stats.todayProfit) : '-'}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] text-zinc-600">total </span>
                  <span className="text-[10px] text-amber-400/70 font-medium">
                    {stats && stats.totalProfit !== null ? formatCurrency(stats.totalProfit) : '-'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Low Stock */}
        <motion.div variants={itemVariants}>
          <Card className={`bg-zinc-900 border rounded-xl overflow-hidden relative ${
            stats && stats.lowStockProducts > 0 ? 'border-red-500/20' : 'border-zinc-800/60'
          }`}>
            <div className={`absolute inset-0 ${stats && stats.lowStockProducts > 0 ? 'bg-gradient-to-br from-red-500/[0.04] to-transparent' : 'bg-gradient-to-br from-zinc-500/[0.02] to-transparent'}`} />
            <CardContent className="p-3.5 relative">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Stok Menipis</p>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  stats && stats.lowStockProducts > 0 ? 'bg-red-500/10 text-red-400' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  <AlertTriangle className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className={`text-xl font-bold tracking-tight ${
                stats && stats.lowStockProducts > 0 ? 'text-red-400' : 'text-zinc-100'
              }`}>
                {stats ? formatNumber(stats.lowStockProducts) : '-'}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5">
                {stats && stats.lowStockProducts > 0 ? (
                  <span className="text-[10px] text-red-400/70 font-medium">perlu restok</span>
                ) : (
                  <span className="text-[10px] text-zinc-600">semua aman</span>
                )}
                {stats && stats.lowStockProducts > 0 && (
                  <motion.span
                    className="relative flex h-2 w-2"
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-40" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </motion.span>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════════════
          5. Quick Actions
      ═══════════════════════════════════════════════════ */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { icon: <PlusCircle className="h-4 w-4 text-emerald-400" />, label: 'Tambah Produk', page: 'products' as const },
            { icon: <ShoppingCart className="h-4 w-4 text-violet-400" />, label: 'Transaksi Baru', page: 'pos' as const },
            { icon: <FileBarChart className="h-4 w-4 text-sky-400" />, label: 'Laporan', page: 'transactions' as const },
          ].map((item) => (
            <Button
              key={item.page}
              variant="outline"
              className="h-auto py-2.5 px-2 bg-zinc-900 border-zinc-800/60 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100 transition-all rounded-xl gap-2 justify-center"
              onClick={() => setCurrentPage(item.page)}
            >
              {item.icon}
              <span className="text-[11px] font-medium">{item.label}</span>
            </Button>
          ))}
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════
          6. Forecast & Analytics Section (PRO+)
      ═══════════════════════════════════════════════════ */}
      {isOwner && (
        <motion.div variants={itemVariants}>
          <Tabs defaultValue="forecast" className="space-y-3">
            <TabsList className="bg-zinc-900 border border-zinc-800/60 rounded-xl h-9 p-1">
              <TabsTrigger value="forecast" className="text-xs gap-1.5 rounded-lg data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100">
                {!hasForecasting && <Lock className="h-3 w-3" />}
                <Activity className="h-3 w-3" />
                Forecasting
              </TabsTrigger>
              <TabsTrigger value="pnl" className="text-xs gap-1.5 rounded-lg data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100">
                <BarChart3 className="h-3 w-3" />
                Laba & Rugi
              </TabsTrigger>
              <TabsTrigger value="peak" className="text-xs gap-1.5 rounded-lg data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100">
                {!isPro && <Lock className="h-3 w-3" />}
                <Clock className="h-3 w-3" />
                Jam Ramai
              </TabsTrigger>
            </TabsList>

            {/* ── Forecast Tab ── */}
            <TabsContent value="forecast" className="mt-0">
              {!hasForecasting ? (
                <Card className="bg-zinc-900 border border-zinc-800/60 rounded-2xl">
                  <CardContent className="py-10 flex flex-col items-center justify-center text-center">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/10 to-emerald-500/10 border border-zinc-800/60 flex items-center justify-center mb-3">
                      <Activity className="h-6 w-6 text-violet-400/60" />
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-300 mb-1">Forecasting & Prediksi</h3>
                    <p className="text-xs text-zinc-500 max-w-xs mb-4">
                      Prediksi revenue, analisa stok otomatis, dan rekomendasi berbasis data AI
                    </p>
                    <Button
                      size="sm"
                      className="bg-emerald-500/90 hover:bg-emerald-500 text-white text-xs font-medium h-8 px-4 rounded-lg gap-1.5"
                      onClick={() => setCurrentPage('settings')}
                    >
                      <Crown className="h-3 w-3" />
                      Upgrade ke PRO
                    </Button>
                  </CardContent>
                </Card>
              ) : forecastLoading && !forecastData ? (
                <Card className="bg-zinc-900 border border-zinc-800/60 rounded-2xl">
                  <CardContent className="p-5 space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 bg-zinc-800 rounded-xl" />
                      ))}
                    </div>
                    <Skeleton className="h-40 bg-zinc-800 rounded-xl" />
                    <Skeleton className="h-48 bg-zinc-800 rounded-xl" />
                  </CardContent>
                </Card>
              ) : forecastData ? (
                <div className="space-y-3">
                  {/* Forecast Summary Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Trend direction */}
                    <Card className="bg-zinc-900 border border-zinc-800/60 rounded-xl">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Tren 14 Hari</p>
                          <TrendIcon direction={forecastData.trendDirection} />
                        </div>
                        <p className={`text-sm font-bold ${
                          forecastData.trendDirection === 'up' ? 'text-emerald-400' :
                          forecastData.trendDirection === 'down' ? 'text-red-400' : 'text-zinc-200'
                        }`}>
                          {forecastData.trendDirection === 'up' ? 'Naik' :
                           forecastData.trendDirection === 'down' ? 'Turun' : 'Stabil'}
                        </p>
                        <div className="mt-2">
                          <Sparkline data={trendValues} color={
                            forecastData.trendDirection === 'up' ? 'text-emerald-400' :
                            forecastData.trendDirection === 'down' ? 'text-red-400' : 'text-zinc-400'
                          } height={24} />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Projected Monthly */}
                    <Card className="bg-zinc-900 border border-zinc-800/60 rounded-xl">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Proyeksi Bulan</p>
                          <Target className="h-3.5 w-3.5 text-violet-400" />
                        </div>
                        <p className="text-sm font-bold text-violet-400">
                          {formatCurrency(forecastData.summary.projectedMonthly)}
                        </p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          ~{formatCurrency(forecastData.summary.avgDailyRevenue)}/hari
                        </p>
                      </CardContent>
                    </Card>

                    {/* Week over week */}
                    <Card className="bg-zinc-900 border border-zinc-800/60 rounded-xl">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Week vs Week</p>
                          {forecastData.summary.weekOverWeek > 0
                            ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                            : forecastData.summary.weekOverWeek < 0
                              ? <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />
                              : <Minus className="h-3.5 w-3.5 text-zinc-400" />}
                        </div>
                        <p className={`text-sm font-bold ${
                          forecastData.summary.weekOverWeek > 0 ? 'text-emerald-400' :
                          forecastData.summary.weekOverWeek < 0 ? 'text-red-400' : 'text-zinc-200'
                        }`}>
                          {forecastData.summary.weekOverWeek > 0 ? '+' : ''}{forecastData.summary.weekOverWeek}%
                        </p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">vs minggu lalu</p>
                      </CardContent>
                    </Card>

                    {/* Stock alerts */}
                    <Card className={`bg-zinc-900 border rounded-xl ${
                      forecastData.summary.criticalStock > 0 ? 'border-red-500/20' : 'border-zinc-800/60'
                    }`}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Stok Kritis</p>
                          <Warehouse className="h-3.5 w-3.5 text-red-400" />
                        </div>
                        <p className={`text-sm font-bold ${
                          forecastData.summary.criticalStock > 0 ? 'text-red-400' :
                          forecastData.summary.warningStock > 0 ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {forecastData.summary.criticalStock > 0
                            ? `${forecastData.summary.criticalStock} kritis`
                            : forecastData.summary.warningStock > 0
                              ? `${forecastData.summary.warningStock} peringatan`
                              : 'Aman'}
                        </p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          berdasarkan velocity
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Revenue Trend + Forecast Line Chart */}
                  <Card className="bg-zinc-900 border border-zinc-800/60 rounded-2xl">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-violet-400" />
                          <h2 className="text-sm font-semibold text-zinc-200">Revenue Trend & Forecast</h2>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-[2px] rounded-full bg-emerald-400" />
                            <span className="text-[10px] text-zinc-500">Aktual</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-[2px] rounded-full bg-violet-400 border-dashed" />
                            <span className="text-[10px] text-zinc-500">Prediksi</span>
                          </div>
                        </div>
                      </div>
                      <RevenueLineChart trend={forecastData.trend} forecast={forecastData.forecast} />
                    </CardContent>
                  </Card>

                  {/* Bottom: Stock Predictions + Day Performance */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* Stock Depletion Predictions */}
                    <Card className="bg-zinc-900 border border-zinc-800/60 rounded-2xl">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Warehouse className="h-4 w-4 text-amber-400" />
                          <h2 className="text-sm font-semibold text-zinc-200">Prediksi Stok</h2>
                          {forecastData.stockPredictions.length > 0 && (
                            <Badge className="text-[9px] bg-zinc-800 border-zinc-700/50 text-zinc-400 ml-auto">
                              {forecastData.stockPredictions.length} produk
                            </Badge>
                          )}
                        </div>
                        {forecastData.stockPredictions.length === 0 ? (
                          <div className="flex flex-col items-center py-6 text-center">
                            <Package className="h-7 w-7 text-zinc-700 mb-1.5" />
                            <p className="text-xs text-zinc-500">Belum cukup data untuk prediksi</p>
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                            {forecastData.stockPredictions.map((p, i) => (
                              <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
                                p.status === 'critical' ? 'bg-red-500/[0.04] border-red-500/15' :
                                p.status === 'warning' ? 'bg-amber-500/[0.04] border-amber-500/15' :
                                'bg-zinc-800/30 border-zinc-700/30'
                              }`}>
                                <span className="text-[10px] font-bold text-zinc-600 w-4 text-center shrink-0">{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-zinc-300 truncate">{p.name}</p>
                                  <p className="text-[10px] text-zinc-500">
                                    sisa {p.stock} • {p.dailyVelocity}/hari
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className={`text-xs font-bold ${
                                    p.status === 'critical' ? 'text-red-400' :
                                    p.status === 'warning' ? 'text-amber-400' : 'text-zinc-300'
                                  }`}>
                                    {p.daysUntilEmpty === Infinity ? '∞' : `${p.daysUntilEmpty}h`}
                                  </p>
                                  <p className="text-[9px] text-zinc-600">habis</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Day of Week Performance */}
                    <Card className="bg-zinc-900 border border-zinc-800/60 rounded-2xl">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Clock className="h-4 w-4 text-sky-400" />
                          <h2 className="text-sm font-semibold text-zinc-200">Performa per Hari</h2>
                        </div>
                        {forecastData.dayPerformance.length === 0 ? (
                          <div className="flex flex-col items-center py-6 text-center">
                            <Clock className="h-7 w-7 text-zinc-700 mb-1.5" />
                            <p className="text-xs text-zinc-500">Belum cukup data</p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {/* Reorder: Sen first */}
                            {[...forecastData.dayPerformance.slice(1), forecastData.dayPerformance[0]].map((d) => (
                              <DayHeatBar
                                key={d.day}
                                day={d.day}
                                avgRevenue={d.avgRevenue}
                                maxRevenue={Math.max(...forecastData.dayPerformance.map((dp) => dp.avgRevenue), 1)}
                                avgTx={d.avgTx}
                              />
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : null}
            </TabsContent>

            {/* ── P&L Tab ── */}
            <TabsContent value="pnl" className="mt-0">
              <Card className="bg-zinc-900 border border-zinc-800/60 rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="h-4 w-4 text-amber-400" />
                    <h2 className="text-sm font-semibold text-zinc-200">Laba & Rugi Hari Ini</h2>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
                    {[
                      { label: 'Brutto', value: stats?.todayBrutto ?? 0, color: 'text-zinc-200', barColor: 'bg-zinc-400' },
                      { label: 'Diskon', value: -(stats?.todayDiscount ?? 0), color: 'text-red-400', barColor: 'bg-red-400' },
                      { label: 'Netto', value: stats?.todayRevenue ?? 0, color: 'text-emerald-400', barColor: 'bg-emerald-400' },
                      { label: 'PPN', value: stats?.todayTax ?? 0, color: 'text-sky-400', barColor: 'bg-sky-400' },
                      { label: 'Profit', value: stats?.todayProfit ?? 0, color: 'text-amber-400', barColor: 'bg-amber-400' },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-3 space-y-2">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">{item.label}</p>
                        <p className={`text-sm font-bold ${item.color}`}>
                          {item.value < 0 ? '-' : ''}{formatCurrency(Math.abs(item.value))}
                        </p>
                        <MiniBar value={Math.abs(item.value)} max={stats?.todayBrutto ?? 1} color={item.barColor} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Peak Hours Tab ── */}
            <TabsContent value="peak" className="mt-0">
              {!isPro ? (
                <Card className="bg-zinc-900 border border-zinc-800/60 rounded-2xl">
                  <CardContent className="py-10 flex flex-col items-center justify-center text-center">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/10 to-sky-500/10 border border-zinc-800/60 flex items-center justify-center mb-3">
                      <Clock className="h-6 w-6 text-violet-400/60" />
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-300 mb-1">Analisa Jam Ramai</h3>
                    <p className="text-xs text-zinc-500 max-w-xs mb-4">
                      Lihat jam tersibuk untuk optimasi shift karyawan dan operasional
                    </p>
                    <Button
                      size="sm"
                      className="bg-emerald-500/90 hover:bg-emerald-500 text-white text-xs font-medium h-8 px-4 rounded-lg gap-1.5"
                      onClick={() => setCurrentPage('settings')}
                    >
                      <Crown className="h-3 w-3" />
                      Upgrade ke PRO
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-zinc-900 border border-zinc-800/60 rounded-2xl">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-violet-400" />
                        <h2 className="text-sm font-semibold text-zinc-200">Jam Ramai Hari Ini</h2>
                        {busiestHour && busiestHour.transactionCount > 0 && (
                          <Badge className="bg-violet-500/10 border-violet-500/20 text-violet-400 text-[10px]">
                            Puncak: {String(busiestHour.hour).padStart(2, '0')}:00
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="relative h-36 sm:h-44">
                      <div className="absolute left-0 top-0 bottom-6 w-7 flex flex-col justify-between text-[10px] text-zinc-600">
                        <span>{maxTxCount}</span>
                        <span>{Math.round(maxTxCount / 2)}</span>
                        <span>0</span>
                      </div>
                      <div className="ml-9 h-full flex items-end gap-[3px]">
                        {stats?.peakHours?.map((bucket) => {
                          const heightPct = maxTxCount > 0 ? (bucket.transactionCount / maxTxCount) * 100 : 0
                          const isPeak = busiestHour?.hour === bucket.hour && bucket.transactionCount > 0
                          return (
                            <div key={bucket.hour} className="flex-1 flex flex-col items-center gap-1 group relative">
                              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 shadow-lg">
                                <p className="text-zinc-300 font-medium">
                                  {String(bucket.hour).padStart(2, '0')}:00 — {bucket.transactionCount} trx
                                </p>
                                <p className="text-emerald-400">{formatCurrency(bucket.revenue)}</p>
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
                              {bucket.hour % 3 === 0 && (
                                <span className="text-[9px] text-zinc-600 -mt-0.5">{String(bucket.hour).padStart(2, '0')}</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      <div className="ml-9 h-px bg-zinc-800" />
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════
          7. Insight Card (OWNER, AI Insights feature)
      ═══════════════════════════════════════════════════ */}
      {isOwner && hasAiInsights && (
        <motion.div variants={itemVariants}>
          {insightLoading && !insightData ? (
            <Card className="bg-zinc-900 border border-zinc-800/60 rounded-2xl">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded bg-zinc-800" />
                  <Skeleton className="h-4 w-32 bg-zinc-800" />
                </div>
                <Skeleton className="h-4 w-72 bg-zinc-800" />
                <Skeleton className="h-3 w-full bg-zinc-800" />
                <div className="flex gap-2">
                  <Skeleton className="h-7 w-24 rounded-lg bg-zinc-800" />
                  <Skeleton className="h-7 w-24 rounded-lg bg-zinc-800" />
                </div>
              </CardContent>
            </Card>
          ) : insightData ? (
            <Card className={`bg-zinc-900 border rounded-2xl overflow-hidden relative ${
              insightData.healthScore >= 75 ? 'border-emerald-500/15' : insightData.healthScore >= 50 ? 'border-amber-500/15' : 'border-red-500/15'
            }`}>
              <div className={`absolute inset-0 pointer-events-none ${
                insightData.healthScore >= 75
                  ? 'bg-gradient-to-br from-emerald-500/[0.03] to-transparent'
                  : insightData.healthScore >= 50
                    ? 'bg-gradient-to-br from-amber-500/[0.03] to-transparent'
                    : 'bg-gradient-to-br from-red-500/[0.03] to-transparent'
              }`} />
              <CardContent className="p-5 relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-violet-400" />
                    <h2 className="text-sm font-semibold text-zinc-200">AI Insight Hari Ini</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <HealthRing score={insightData.healthScore} size="sm" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={fetchInsights}
                      disabled={insightLoading}
                      className="h-7 text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 gap-1"
                    >
                      <RefreshCw className={`h-3 w-3 ${insightLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
                {insightData.topInsight ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <PriorityDot priority={insightData.topInsight.priority} />
                      <h3 className="text-sm font-semibold text-zinc-100">
                        {insightData.topInsight.emoji} {insightData.topInsight.title}
                      </h3>
                    </div>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      {insightData.topInsight.why}
                    </p>
                    {insightData.topInsight.actions.length > 0 && (
                      <ul className="space-y-1">
                        {insightData.topInsight.actions.map((action, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                            <span className="text-violet-400 mt-0.5 shrink-0">•</span>
                            {action}
                          </li>
                        ))}
                      </ul>
                    )}
                    {insightData.topInsight.cta.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {insightData.topInsight.cta.map((cta, i) => (
                          <Button
                            key={i}
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs font-medium bg-zinc-800/80 border-zinc-700/50 hover:bg-zinc-700 hover:border-zinc-600 text-zinc-300 rounded-lg gap-1.5"
                            onClick={() => setCurrentPage(cta.page as 'pos' | 'products' | 'transactions' | 'customers' | 'settings' | 'crew' | 'dashboard' | 'audit-log')}
                          >
                            {cta.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 py-2">Semua berjalan baik! Tidak ada insight penting saat ini.</p>
                )}
                {otherInsights.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-zinc-800/80">
                    {otherInsights.slice(0, 5).map((insight) => (
                      <button
                        key={insight.id}
                        onClick={() => setInsightData((prev) => prev ? { ...prev, topInsight: insight } : null)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border cursor-pointer transition-colors hover:bg-zinc-800/80 ${getPriorityBg(insight.priority)}`}
                      >
                        <PriorityDot priority={insight.priority} />
                        <span className="max-w-[140px] truncate text-zinc-400">{insight.emoji} {insight.title}</span>
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
          8. Bottom Row — Top Products & Top Customers
      ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Top Products */}
        <motion.div variants={itemVariants}>
          <Card className="bg-zinc-900 border border-zinc-800/60 rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-zinc-200">Produk Terlaris</h2>
              </div>
              {topSelling.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Package className="h-7 w-7 text-zinc-700 mb-1.5" />
                  <p className="text-xs text-zinc-500">Belum ada data hari ini</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {topSelling.slice(0, 5).map((p, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-800/30 border border-zinc-700/20">
                      <span className={`text-[11px] font-bold w-4 text-center shrink-0 ${i === 0 ? 'text-amber-400' : 'text-zinc-600'}`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-zinc-300 truncate">{p.name}</p>
                        <p className="text-[10px] text-zinc-500">{formatNumber(p.qty)} unit</p>
                      </div>
                      <p className="text-xs font-semibold text-emerald-400 shrink-0">{formatCurrency(p.revenue)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Customers — OWNER */}
        {isOwner && (
          <motion.div variants={itemVariants}>
            <Card className="bg-zinc-900 border border-zinc-800/60 rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-sky-400" />
                  <h2 className="text-sm font-semibold text-zinc-200">Top Customer</h2>
                </div>
                {(!stats?.topCustomers || stats.topCustomers.length === 0) ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Users className="h-7 w-7 text-zinc-700 mb-1.5" />
                    <p className="text-xs text-zinc-500">Belum ada data customer</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {stats.topCustomers.map((c, i) => (
                      <div key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-800/30 border border-zinc-700/20">
                        <span className={`text-[11px] font-bold w-4 text-center shrink-0 ${i === 0 ? 'text-amber-400' : 'text-zinc-600'}`}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-zinc-300 truncate">{c.name}</p>
                          <p className="text-[10px] text-zinc-500">{c.points} poin</p>
                        </div>
                        <p className="text-xs font-semibold text-sky-400 shrink-0">{formatCurrency(c.totalSpend)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
