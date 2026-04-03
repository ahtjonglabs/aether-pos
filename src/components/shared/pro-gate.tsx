'use client'

import { usePlan } from '@/hooks/use-plan'
import { Lock, Crown } from 'lucide-react'

interface ProGateProps {
  /** The feature key from PlanFeatures to check */
  feature: keyof import('@/lib/plan-config').PlanFeatures
  /** Content to render for Pro users */
  children: React.ReactNode
  /** Optional custom label for the upgrade banner */
  label?: string
  /** Optional custom description */
  description?: string
  /** Blur intensity (default: 6) */
  blur?: number
  /** Minimum height for the blurred area */
  minHeight?: string
}

/**
 * ProGate — Blurs Pro-only features for free accounts.
 *
 * Wraps any UI element and shows a blurred overlay with
 * an upgrade prompt for users on the free plan.
 *
 * Usage:
 *   <ProGate feature="exportExcel" label="Export Excel">
 *     <ExportButton />
 *   </ProGate>
 */
export function ProGate({
  feature,
  children,
  label,
  description,
  blur = 6,
  minHeight = '120px',
}: ProGateProps) {
  const { features, plan, isLoading } = usePlan()

  // Don't gate anything while loading or if plan data is unavailable
  if (isLoading || !features) {
    return <>{children}</>
  }

  const value = features[feature]

  // Determine if the feature is available
  let isAvailable = false
  if (typeof value === 'boolean') {
    isAvailable = value
  } else if (Array.isArray(value)) {
    isAvailable = value.length > 0
  } else {
    // Numeric feature - always show the UI, limits are handled separately
    isAvailable = true
  }

  if (isAvailable) {
    return <>{children}</>
  }

  const isPro = plan?.type === 'pro'
  const isEnterprise = plan?.type === 'enterprise'

  // Enterprise plan should have all features
  if (isPro || isEnterprise) {
    return <>{children}</>
  }

  const displayLabel = label || getFeatureLabel(feature)
  const displayDescription = description || 'Fitur ini tersedia untuk akun Pro'

  return (
    <div className="relative" style={{ minHeight }}>
      {/* Blurred content underneath */}
      <div
        className="pointer-events-none select-none"
        style={{ filter: `blur(${blur}px)`, opacity: 0.5 }}
      >
        {children}
      </div>

      {/* Overlay with upgrade prompt */}
      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-zinc-900/60 backdrop-blur-[2px] border border-dashed border-zinc-700/50 z-10">
        <div className="flex flex-col items-center gap-2 px-4 text-center">
          <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center">
            <Crown className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-200">{displayLabel}</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">{displayDescription}</p>
          </div>
          <div className="flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <Lock className="h-3 w-3 text-violet-400" />
            <span className="text-[11px] font-medium text-violet-400">Pro</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Get a human-readable label for a feature key */
function getFeatureLabel(feature: string): string {
  const labels: Record<string, string> = {
    productImage: 'Upload Foto Produk',
    crewPermissions: 'Hak Akses Crew',
    bulkUpload: 'Upload Excel',
    exportExcel: 'Export Excel',
    offlineMode: 'Mode Offline',
    multiOutlet: 'Multi Outlet',
    apiAccess: 'API Access',
    prioritySupport: 'Support Prioritas',
    loyaltyProgram: 'Program Loyalti',
    dashboardAnalytics: 'Analytics Dashboard',
    stockMovement: 'Pergerakan Stok',
    auditLog: 'Audit Log',
    transactionSummary: 'Ringkasan Transaksi',
  }
  return labels[feature] || 'Fitur Pro'
}
