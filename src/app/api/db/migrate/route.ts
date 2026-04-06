import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { safeJson, safeJsonError } from '@/lib/safe-response'

/**
 * Database Schema Auto-Migration
 *
 * Ensures the Neon/PostgreSQL database has all required columns and tables,
 * even if `prisma db push` was never run or failed silently on deploy.
 *
 * Uses raw SQL — works without Prisma CLI. Safe to call multiple times (idempotent).
 *
 * Covers post-initial-schema features:
 *  - hasVariants column on Product
 *  - ProductVariant table + unique index
 *  - variantId / variantName columns on TransactionItem
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return unauthorized()
    }

    const results: string[] = []

    // ===== 1. Product.hasVariants column =====
    try {
      await db.$executeRawUnsafe(
        `ALTER TABLE "Product" ADD COLUMN "hasVariants" BOOLEAN NOT NULL DEFAULT false;`
      )
      results.push('Added Product.hasVariants column')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('already exists') || msg.includes('duplicate')) {
        results.push('Product.hasVariants already exists')
      } else {
        results.push(`Product.hasVariants: ${msg}`)
      }
    }

    // Fix any NULL values (belt-and-suspenders)
    try {
      const r = await db.$executeRawUnsafe(
        `UPDATE "Product" SET "hasVariants" = false WHERE "hasVariants" IS NULL;`
      )
      results.push(`Fixed ${Number(r)} NULL hasVariants`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      results.push(`Fix NULL hasVariants: ${msg}`)
    }

    // ===== 2. ProductVariant table =====
    try {
      await db.$executeRawUnsafe(`
        CREATE TABLE "ProductVariant" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "name" TEXT NOT NULL,
          "sku" TEXT,
          "price" REAL NOT NULL DEFAULT 0,
          "hpp" REAL NOT NULL DEFAULT 0,
          "stock" INTEGER NOT NULL DEFAULT 0,
          "lowStockAlert" INTEGER NOT NULL DEFAULT 10,
          "productId" TEXT NOT NULL,
          "outletId" TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE,
          FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE RESTRICT
        );
      `)
      results.push('Created ProductVariant table')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('already exists')) {
        results.push('ProductVariant table already exists')
      } else {
        results.push(`ProductVariant: ${msg}`)
      }
    }

    // Unique index (name, productId)
    try {
      await db.$executeRawUnsafe(
        `CREATE UNIQUE INDEX "ProductVariant_name_productId_key" ON "ProductVariant"("name", "productId");`
      )
      results.push('Created ProductVariant unique index')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('already exists') || msg.includes('duplicate')) {
        results.push('ProductVariant index already exists')
      } else {
        results.push(`ProductVariant index: ${msg}`)
      }
    }

    // ===== 3. TransactionItem.variantId & variantName =====
    for (const col of ['variantId', 'variantName'] as const) {
      try {
        await db.$executeRawUnsafe(
          `ALTER TABLE "TransactionItem" ADD COLUMN "${col}" TEXT;`
        )
        results.push(`Added TransactionItem.${col} column`)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.includes('already exists') || msg.includes('duplicate')) {
          results.push(`TransactionItem.${col} already exists`)
        } else {
          results.push(`TransactionItem.${col}: ${msg}`)
        }
      }
    }

    return safeJson({ success: true, results })
  } catch (error) {
    console.error('DB migration error:', error)
    return safeJsonError('Database migration failed')
  }
}
