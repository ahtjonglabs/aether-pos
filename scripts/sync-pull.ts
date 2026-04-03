/**
 * scripts/sync-pull.ts
 *
 * Pull data from Production PostgreSQL (Neon) → Local SQLite
 *
 * Usage:  bun run sync:pull
 *
 * Requires DEPLOY_DATABASE_URL in .env or environment
 */

import { pullDeployToLocal } from '../src/lib/sync-db'

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  AETHER POS — Sync: Production → Local')
  console.log('═══════════════════════════════════════════════════\n')

  if (!process.env.DEPLOY_DATABASE_URL) {
    console.error('❌ ERROR: DEPLOY_DATABASE_URL is not set.')
    console.error('   Add it to your .env file:')
    console.error('   DEPLOY_DATABASE_URL=postgresql://user:pass@host/db?sslmode=require')
    console.error('')
    process.exit(1)
  }

  const startTime = Date.now()

  try {
    const stats = await pullDeployToLocal()
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

    console.log('\n═══════════════════════════════════════════════════')
    console.log('  SYNC SUMMARY')
    console.log('═══════════════════════════════════════════════════')
    console.log(`  Time: ${elapsed}s`)
    console.log(`  Outlets:      ${stats.outlets.created}+, ${stats.outlets.updated}~`)
    console.log(`  Users:        ${stats.users.created}+, ${stats.users.updated}~`)
    console.log(`  Products:     ${stats.products.created}+, ${stats.products.updated}~`)
    console.log(`  Customers:    ${stats.customers.created}+, ${stats.customers.updated}~`)
    console.log(`  Promos:       ${stats.promos.created}+, ${stats.promos.updated}~`)
    console.log(`  Settings:     ${stats.settings.created}+, ${stats.settings.updated}~`)
    console.log(`  Permissions:  ${stats.permissions.created}+, ${stats.permissions.updated}~`)
    console.log(`  Transactions: ${stats.transactions.created}+, ${stats.transactions.skipped} skipped`)
    console.log('═══════════════════════════════════════════════════')
  } catch (error) {
    console.error('\n❌ Sync failed:', error)
    process.exit(1)
  }
}

main()
