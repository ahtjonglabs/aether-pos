/**
 * db.ts — Smart Prisma Client Switcher
 *
 * DATABASE_PROVIDER=sqlite (default)  → Uses @prisma/client (local SQLite)
 * DATABASE_PROVIDER=postgresql       → Uses @aether/prisma-deploy (Neon PostgreSQL)
 *
 * This file is the SINGLE import point for all API routes.
 * No other file needs to know which database is active.
 *
 * Setup:
 *   Local dev:  Uses schema.prisma (SQLite) — no extra setup needed
 *   Deploy:     bun run db:deploy:generate  → generates @aether/prisma-deploy
 *               DATABASE_PROVIDER=postgresql bun run build:deploy
 */

import { PrismaClient } from '@prisma/client'

type PrismaClientLike = InstanceType<typeof PrismaClient>

// ---------- Lazy deploy client loader ----------
let _DeployClient: typeof PrismaClient | null = null

function loadDeployClient(): typeof PrismaClient {
  if (_DeployClient) return _DeployClient
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@aether/prisma-deploy')
    _DeployClient = mod.PrismaClient
    if (!_DeployClient) {
      throw new Error('PrismaClient not found in @aether/prisma-deploy')
    }
    return _DeployClient
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : String(err)
    if (msg.includes('MODULE_NOT_FOUND') || msg.includes('Cannot find')) {
      throw new Error(
        '[db.ts] Deploy Prisma client (@aether/prisma-deploy) not found.\n' +
          '  Run:  bun run db:deploy:generate\n' +
          '  Then: DATABASE_PROVIDER=postgresql bun run build:deploy'
      )
    }
    throw err
  }
}

// ---------- Singleton factories ----------
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientLike | undefined
}

function createClient(): PrismaClientLike {
  const provider = process.env.DATABASE_PROVIDER || 'sqlite'

  if (provider === 'postgresql') {
    console.log('[db] 🚀 Using PostgreSQL (Neon) — production mode')
    const Client = loadDeployClient()
    return new Client({
      log: process.env.NODE_ENV === 'development' ? ['query'] : [],
    })
  }

  console.log('[db] 📦 Using SQLite — local development mode')
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })
}

export const db: PrismaClientLike =
  globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}

/**
 * Get the current database provider name.
 */
export function getDbProvider(): 'sqlite' | 'postgresql' {
  return process.env.DATABASE_PROVIDER === 'postgresql'
    ? 'postgresql'
    : 'sqlite'
}

/**
 * Create a fresh deploy-only Prisma client (no singleton).
 * Used by sync scripts that need to talk to BOTH databases simultaneously.
 */
export function createDeployOnlyClient(): PrismaClientLike {
  const Client = loadDeployClient()
  return new Client({ log: ['warn', 'error'] })
}
