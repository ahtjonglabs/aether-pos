/**
 * auto-migrate.ts — Database schema auto-migration (runs once per process)
 *
 * Ensures required columns/tables exist in PostgreSQL/Neon even if
 * `prisma db push` was never run or failed silently on deploy.
 *
 * Uses a module-level flag so it only executes ONCE per server cold start.
 * In serverless (Vercel), that means once per function instance cold start.
 * In dev, once per hot reload cycle.
 *
 * All statements are idempotent — safe to call multiple times across restarts.
 */

import { db } from './db'

let migrated = false
let migrating = false

async function runMigrate() {
  if (migrated || migrating) return
  migrating = true

  try {
    // 1. Product.hasVariants column
    try {
      await db.$executeRawUnsafe(
        `ALTER TABLE "Product" ADD COLUMN "hasVariants" BOOLEAN NOT NULL DEFAULT false;`
      )
    } catch {}
    try {
      await db.$executeRawUnsafe(
        `UPDATE "Product" SET "hasVariants" = false WHERE "hasVariants" IS NULL;`
      )
    } catch {}

    // 2. ProductVariant table
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
    } catch {}
    // Unique index (name, productId)
    try {
      await db.$executeRawUnsafe(
        `CREATE UNIQUE INDEX "ProductVariant_name_productId_key" ON "ProductVariant"("name", "productId");`
      )
    } catch {}

    // 3. TransactionItem variant columns
    try { await db.$executeRawUnsafe(`ALTER TABLE "TransactionItem" ADD COLUMN "variantId" TEXT;`) } catch {}
    try { await db.$executeRawUnsafe(`ALTER TABLE "TransactionItem" ADD COLUMN "variantName" TEXT;`) } catch {}

    migrated = true
  } catch (error) {
    console.error('[auto-migrate] Error:', error)
    // Don't set migrated = true so it can retry on next request
  } finally {
    migrating = false
  }
}

/**
 * Call this at the start of any API route that needs variant support.
 * No-op after first successful run. Non-blocking (fire-and-forget).
 */
export function ensureMigrated(): void {
  runMigrate() // intentionally not awaited — runs in background
}
