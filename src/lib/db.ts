/**
 * db.ts — Prisma Client (PostgreSQL via Neon)
 *
 * SINGLE import point for all API routes.
 * Works with both Neon (production/Vercel) and local PostgreSQL.
 *
 * Offline mode (POS) uses IndexedDB (Dexie) client-side — independent of this.
 */

import { PrismaClient } from '@prisma/client'

// ---------- Singleton ----------
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL || ''

  if (dbUrl.includes('postgresql') || dbUrl.includes('postgres') || dbUrl.includes('neon')) {
    console.log('[db] 🐘 Using PostgreSQL (Neon)')
  } else {
    console.log('[db] 📦 Using database:', dbUrl ? 'configured' : 'NOT CONFIGURED')
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : [],
  })
}

export const db: PrismaClient =
  globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
