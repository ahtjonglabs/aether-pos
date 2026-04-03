/**
 * api-helpers.ts — Shared API Route Utilities
 *
 * Centralizes common patterns used across all API routes:
 * - Pagination parsing
 * - Plan type resolution (suspended prefix handling)
 * - Invoice number generation
 * - Owner/role authorization shortcuts
 */

import { type PrismaClient } from '@prisma/client'

// ============================================================
// Pagination
// ============================================================

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export interface Pagination {
  page: number
  limit: number
  skip: number
}

/**
 * Parse page/limit from URL searchParams with safe defaults.
 */
export function parsePagination(
  searchParams: URLSearchParams,
  defaults?: { page?: number; limit?: number }
): Pagination {
  const page = Math.max(1, Number(searchParams.get('page')) || defaults?.page || DEFAULT_PAGE)
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(searchParams.get('limit')) || defaults?.limit || DEFAULT_LIMIT)
  )
  return { page, limit, skip: (page - 1) * limit }
}

// ============================================================
// Plan Resolution
// ============================================================

/**
 * Resolve the effective plan type from raw accountType string.
 * Handles "suspended:xxx" prefix transparently.
 */
export function resolvePlanType(accountType: string | null | undefined): string {
  if (!accountType) return 'free'
  return accountType.startsWith('suspended:')
    ? accountType.replace('suspended:', '')
    : accountType
}

// ============================================================
// Invoice Number
// ============================================================

/**
 * Generate a unique invoice number: INV-YYYYMMDD-XXXXX
 */
export function generateInvoiceNumber(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const random = String(Math.floor(Math.random() * 100000)).padStart(5, '0')
  return `INV-${yyyy}${mm}${dd}-${random}`
}

// ============================================================
// Date Range Builder
// ============================================================

/**
 * Build a Prisma-compatible date filter from query params.
 * Returns an object like `{ gte: Date, lte: Date }` or empty object.
 */
export function buildDateFilter(
  dateFrom: string | null,
  dateTo: string | null
): Record<string, Date> {
  const filter: Record<string, Date> = {}
  if (dateFrom) {
    const start = new Date(dateFrom)
    start.setHours(0, 0, 0, 0)
    filter.gte = start
  }
  if (dateTo) {
    const end = new Date(dateTo)
    end.setHours(23, 59, 59, 999)
    filter.lte = end
  }
  return filter
}

// ============================================================
// Voided Transaction Helper
// ============================================================

/**
 * Get a Set of voided transaction IDs for an outlet.
 * Used to filter out voided transactions from queries.
 */
export async function getVoidedTxIds(
  db: PrismaClient,
  outletId: string
): Promise<Set<string | null>> {
  const voided = await db.auditLog.findMany({
    where: {
      entityType: 'TRANSACTION',
      action: 'VOID',
      outletId,
    },
    select: { entityId: true },
  })
  return new Set(voided.map((v) => v.entityId))
}

/**
 * Parse void log details into structured info.
 */
export function parseVoidDetails(
  details: string | null
): { reason: string; voidedBy: string; voidedAt: string } | null {
  if (!details) return null
  try {
    const d = JSON.parse(details)
    return {
      reason: d.reason || '',
      voidedBy: d.voidedBy || '',
      voidedAt: d.voidedAt || '',
    }
  } catch {
    return { reason: '', voidedBy: '', voidedAt: '' }
  }
}

// ============================================================
// Void Map Builder
// ============================================================

/**
 * Build a map of transaction ID → void info from audit logs.
 */
export async function buildVoidMap(
  db: PrismaClient,
  transactionIds: string[],
  outletId: string
): Promise<Map<string, { reason: string; voidedBy: string; voidedAt: string }>> {
  if (transactionIds.length === 0) return new Map()

  const voidLogs = await db.auditLog.findMany({
    where: {
      entityType: 'TRANSACTION',
      entityId: { in: transactionIds },
      action: 'VOID',
      outletId,
    },
    select: { entityId: true, details: true },
  })

  const map = new Map<string, { reason: string; voidedBy: string; voidedAt: string }>()
  for (const log of voidLogs) {
    const info = parseVoidDetails(log.details)
    if (info && log.entityId) {
      map.set(log.entityId, info)
    }
  }
  return map
}
