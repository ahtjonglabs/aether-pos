/**
 * sync-db.ts — Sync Engine between Local SQLite and Production PostgreSQL
 *
 * This module provides functions to push/pull data between:
 *   Source: Local SQLite (default @prisma/client)
 *   Target: Production Neon PostgreSQL (src/generated/prisma-deploy)
 *
 * Usage:
 *   bun run sync:push   — Local → Production
 *   bun run sync:pull   — Production → Local
 */

import { PrismaClient as LocalClient } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'

// Deploy client — only works when @aether/prisma-deploy is installed
function createDeployOnlyClient(): PrismaClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@aether/prisma-deploy')
  return new mod.PrismaClient({ log: ['warn', 'error'] })
}

// ============================================================
// Types
// ============================================================

export interface SyncStats {
  outlets:    { created: number; updated: number; skipped: number }
  users:      { created: number; updated: number; skipped: number }
  products:   { created: number; updated: number; skipped: number }
  customers:  { created: number; updated: number; skipped: number }
  promos:     { created: number; updated: number; skipped: number }
  settings:   { created: number; updated: number; skipped: number }
  permissions:{ created: number; updated: number; skipped: number }
  transactions:{ created: number; updated: number; skipped: number }
}

function emptyStats(): SyncStats {
  return {
    outlets:     { created: 0, updated: 0, skipped: 0 },
    users:       { created: 0, updated: 0, skipped: 0 },
    products:    { created: 0, updated: 0, skipped: 0 },
    customers:   { created: 0, updated: 0, skipped: 0 },
    promos:      { created: 0, updated: 0, skipped: 0 },
    settings:    { created: 0, updated: 0, skipped: 0 },
    permissions: { created: 0, updated: 0, skipped: 0 },
    transactions:{ created: 0, updated: 0, skipped: 0 },
  }
}

// ============================================================
// ID Mapping (SQLite CUID → PostgreSQL CUID)
// ============================================================

/**
 * Build a mapping of old IDs to new IDs for each entity.
 * When pushing, the target may already have some IDs from previous syncs.
 * Strategy: Try to preserve IDs when possible (CUIDs are collision-resistant).
 */
class IdMapper {
  private maps = new Map<string, Map<string, string>>()

  set(entity: string, oldId: string, newId: string) {
    if (!this.maps.has(entity)) this.maps.set(entity, new Map())
    this.maps.get(entity)!.set(oldId, newId)
  }

  get(entity: string, oldId: string): string | undefined {
    return this.maps.get(entity)?.get(oldId)
  }

  // If no mapping exists, return the original ID
  resolve(entity: string, oldId: string): string {
    return this.get(entity, oldId) ?? oldId
  }
}

// ============================================================
// PUSH: Local SQLite → Production PostgreSQL
// ============================================================

export async function pushLocalToDeploy(): Promise<SyncStats> {
  console.log('📤 Pushing local SQLite → Production PostgreSQL...\n')

  const local = new LocalClient({ log: ['error'] })
  const deploy = createDeployOnlyClient()
  const stats = emptyStats()
  const mapper = new IdMapper()

  try {
    // 1. Sync Outlets
    const outlets = await local.outlet.findMany()
    for (const outlet of outlets) {
      const existing = await deploy.outlet.findUnique({ where: { id: outlet.id } })
      if (existing) {
        await deploy.outlet.update({
          where: { id: outlet.id },
          data: {
            name: outlet.name,
            address: outlet.address,
            phone: outlet.phone,
            accountType: outlet.accountType,
          },
        })
        stats.outlets.updated++
      } else {
        await deploy.outlet.create({
          data: {
            id: outlet.id,
            name: outlet.name,
            address: outlet.address,
            phone: outlet.phone,
            accountType: outlet.accountType,
          },
        })
        stats.outlets.created++
      }
      mapper.set('outlet', outlet.id, outlet.id)
    }
    console.log(`   ✅ Outlets: ${stats.outlets.created} created, ${stats.outlets.updated} updated`)

    // 2. Sync Users
    const users = await local.user.findMany()
    for (const user of users) {
      const existing = await deploy.user.findUnique({ where: { id: user.id } })
      const outletId = mapper.resolve('outlet', user.outletId)
      if (existing) {
        await deploy.user.update({
          where: { id: user.id },
          data: { name: user.name, email: user.email, password: user.password, role: user.role, outletId },
        })
        stats.users.updated++
      } else {
        await deploy.user.create({
          data: { id: user.id, name: user.name, email: user.email, password: user.password, role: user.role, outletId },
        })
        stats.users.created++
      }
      mapper.set('user', user.id, user.id)
    }
    console.log(`   ✅ Users: ${stats.users.created} created, ${stats.users.updated} updated`)

    // 3. Sync Products
    const products = await local.product.findMany()
    for (const product of products) {
      const existing = await deploy.product.findUnique({ where: { id: product.id } })
      const outletId = mapper.resolve('outlet', product.outletId)
      if (existing) {
        await deploy.product.update({
          where: { id: product.id },
          data: {
            name: product.name, sku: product.sku, barcode: product.barcode,
            hpp: product.hpp, price: product.price, bruto: product.bruto, netto: product.netto,
            stock: product.stock, lowStockAlert: product.lowStockAlert, image: product.image,
          },
        })
        stats.products.updated++
      } else {
        await deploy.product.create({
          data: {
            id: product.id, name: product.name, sku: product.sku, barcode: product.barcode,
            hpp: product.hpp, price: product.price, bruto: product.bruto, netto: product.netto,
            stock: product.stock, lowStockAlert: product.lowStockAlert, image: product.image, outletId,
          },
        })
        stats.products.created++
      }
      mapper.set('product', product.id, product.id)
    }
    console.log(`   ✅ Products: ${stats.products.created} created, ${stats.products.updated} updated`)

    // 4. Sync Customers
    const customers = await local.customer.findMany()
    for (const customer of customers) {
      const existing = await deploy.customer.findUnique({ where: { id: customer.id } })
      const outletId = mapper.resolve('outlet', customer.outletId)
      if (existing) {
        await deploy.customer.update({
          where: { id: customer.id },
          data: { name: customer.name, whatsapp: customer.whatsapp, totalSpend: customer.totalSpend, points: customer.points },
        })
        stats.customers.updated++
      } else {
        await deploy.customer.create({
          data: { id: customer.id, name: customer.name, whatsapp: customer.whatsapp, totalSpend: customer.totalSpend, points: customer.points, outletId },
        })
        stats.customers.created++
      }
      mapper.set('customer', customer.id, customer.id)
    }
    console.log(`   ✅ Customers: ${stats.customers.created} created, ${stats.customers.updated} updated`)

    // 5. Sync Promos
    const promos = await local.promo.findMany()
    for (const promo of promos) {
      const existing = await deploy.promo.findUnique({ where: { id: promo.id } })
      const outletId = mapper.resolve('outlet', promo.outletId)
      if (existing) {
        await deploy.promo.update({
          where: { id: promo.id },
          data: { name: promo.name, type: promo.type, value: promo.value, minPurchase: promo.minPurchase, maxDiscount: promo.maxDiscount, active: promo.active },
        })
        stats.promos.updated++
      } else {
        await deploy.promo.create({
          data: { id: promo.id, name: promo.name, type: promo.type, value: promo.value, minPurchase: promo.minPurchase, maxDiscount: promo.maxDiscount, active: promo.active, outletId },
        })
        stats.promos.created++
      }
    }
    console.log(`   ✅ Promos: ${stats.promos.created} created, ${stats.promos.updated} updated`)

    // 6. Sync Outlet Settings
    const settings = await local.outletSetting.findMany()
    for (const setting of settings) {
      const existing = await deploy.outletSetting.findUnique({ where: { id: setting.id } })
      const outletId = mapper.resolve('outlet', setting.outletId)
      if (existing) {
        await deploy.outletSetting.update({
          where: { id: setting.id },
          data: {
            paymentMethods: setting.paymentMethods, loyaltyEnabled: setting.loyaltyEnabled,
            loyaltyPointsPerAmount: setting.loyaltyPointsPerAmount, loyaltyPointValue: setting.loyaltyPointValue,
            receiptBusinessName: setting.receiptBusinessName, receiptAddress: setting.receiptAddress,
            receiptPhone: setting.receiptPhone, receiptFooter: setting.receiptFooter,
            receiptLogo: setting.receiptLogo, themePrimaryColor: setting.themePrimaryColor,
          },
        })
        stats.settings.updated++
      } else {
        await deploy.outletSetting.create({
          data: {
            id: setting.id, outletId, paymentMethods: setting.paymentMethods,
            loyaltyEnabled: setting.loyaltyEnabled, loyaltyPointsPerAmount: setting.loyaltyPointsPerAmount,
            loyaltyPointValue: setting.loyaltyPointValue, receiptBusinessName: setting.receiptBusinessName,
            receiptAddress: setting.receiptAddress, receiptPhone: setting.receiptPhone,
            receiptFooter: setting.receiptFooter, receiptLogo: setting.receiptLogo,
            themePrimaryColor: setting.themePrimaryColor,
          },
        })
        stats.settings.created++
      }
    }
    console.log(`   ✅ Settings: ${stats.settings.created} created, ${stats.settings.updated} updated`)

    // 7. Sync Crew Permissions
    const permissions = await local.crewPermission.findMany()
    for (const perm of permissions) {
      const existing = await deploy.crewPermission.findUnique({ where: { id: perm.id } })
      const userId = mapper.resolve('user', perm.userId)
      const outletId = mapper.resolve('outlet', perm.outletId)
      if (existing) {
        await deploy.crewPermission.update({
          where: { id: perm.id },
          data: { userId, pages: perm.pages, outletId },
        })
        stats.permissions.updated++
      } else {
        await deploy.crewPermission.create({
          data: { id: perm.id, userId, pages: perm.pages, outletId },
        })
        stats.permissions.created++
      }
    }
    console.log(`   ✅ Permissions: ${stats.permissions.created} created, ${stats.permissions.updated} updated`)

    // 8. Sync Transactions + Items (batched for performance)
    const transactions = await local.transaction.findMany({
      orderBy: { createdAt: 'asc' },
      include: { items: true },
    })
    const BATCH_SIZE = 50

    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const batch = transactions.slice(i, i + BATCH_SIZE)
      await deploy.$transaction(async (tx) => {
        for (const txn of batch) {
          const existing = await tx.transaction.findUnique({ where: { invoiceNumber: txn.invoiceNumber } })
          if (existing) {
            stats.transactions.skipped++
            continue
          }

          const outletId = mapper.resolve('outlet', txn.outletId)
          const userId = mapper.resolve('user', txn.userId)
          const customerId = txn.customerId ? mapper.resolve('customer', txn.customerId) : null

          await tx.transaction.create({
            data: {
              id: txn.id,
              invoiceNumber: txn.invoiceNumber,
              subtotal: txn.subtotal,
              discount: txn.discount,
              pointsUsed: txn.pointsUsed,
              total: txn.total,
              paymentMethod: txn.paymentMethod,
              paidAmount: txn.paidAmount,
              change: txn.change,
              note: txn.note,
              outletId,
              userId,
              customerId,
              createdAt: txn.createdAt,
              items: {
                create: txn.items.map((item) => ({
                  id: item.id,
                  productId: mapper.resolve('product', item.productId),
                  productName: item.productName,
                  price: item.price,
                  qty: item.qty,
                  subtotal: item.subtotal,
                  hpp: item.hpp,
                })),
              },
            },
          })
          stats.transactions.created++
        }
      })

      const processed = Math.min(i + BATCH_SIZE, transactions.length)
      console.log(`   📦 Transactions: ${processed}/${transactions.length} processed...`)
    }
    console.log(`   ✅ Transactions: ${stats.transactions.created} created, ${stats.transactions.skipped} skipped (duplicates)`)

  } finally {
    await local.$disconnect()
    await deploy.$disconnect()
  }

  console.log('\n🎉 Push complete!')
  return stats
}

// ============================================================
// PULL: Production PostgreSQL → Local SQLite
// ============================================================

export async function pullDeployToLocal(): Promise<SyncStats> {
  console.log('📥 Pulling Production PostgreSQL → Local SQLite...\n')

  const deploy = createDeployOnlyClient()
  const local = new LocalClient({ log: ['error'] })
  const stats = emptyStats()
  const mapper = new IdMapper()

  try {
    // 1. Sync Outlets
    const outlets = await deploy.outlet.findMany()
    for (const outlet of outlets) {
      const existing = await local.outlet.findUnique({ where: { id: outlet.id } })
      if (existing) {
        await local.outlet.update({
          where: { id: outlet.id },
          data: { name: outlet.name, address: outlet.address, phone: outlet.phone, accountType: outlet.accountType },
        })
        stats.outlets.updated++
      } else {
        await local.outlet.create({
          data: { id: outlet.id, name: outlet.name, address: outlet.address, phone: outlet.phone, accountType: outlet.accountType },
        })
        stats.outlets.created++
      }
      mapper.set('outlet', outlet.id, outlet.id)
    }
    console.log(`   ✅ Outlets: ${stats.outlets.created} created, ${stats.outlets.updated} updated`)

    // 2. Sync Users
    const users = await deploy.user.findMany()
    for (const user of users) {
      const existing = await local.user.findUnique({ where: { id: user.id } })
      const outletId = mapper.resolve('outlet', user.outletId)
      if (existing) {
        await local.user.update({
          where: { id: user.id },
          data: { name: user.name, email: user.email, password: user.password, role: user.role, outletId },
        })
        stats.users.updated++
      } else {
        await local.user.create({
          data: { id: user.id, name: user.name, email: user.email, password: user.password, role: user.role, outletId },
        })
        stats.users.created++
      }
      mapper.set('user', user.id, user.id)
    }
    console.log(`   ✅ Users: ${stats.users.created} created, ${stats.users.updated} updated`)

    // 3. Sync Products
    const products = await deploy.product.findMany()
    for (const product of products) {
      const existing = await local.product.findUnique({ where: { id: product.id } })
      const outletId = mapper.resolve('outlet', product.outletId)
      if (existing) {
        await local.product.update({
          where: { id: product.id },
          data: {
            name: product.name, sku: product.sku, barcode: product.barcode,
            hpp: product.hpp, price: product.price, bruto: product.bruto, netto: product.netto,
            stock: product.stock, lowStockAlert: product.lowStockAlert, image: product.image,
          },
        })
        stats.products.updated++
      } else {
        await local.product.create({
          data: {
            id: product.id, name: product.name, sku: product.sku, barcode: product.barcode,
            hpp: product.hpp, price: product.price, bruto: product.bruto, netto: product.netto,
            stock: product.stock, lowStockAlert: product.lowStockAlert, image: product.image, outletId,
          },
        })
        stats.products.created++
      }
      mapper.set('product', product.id, product.id)
    }
    console.log(`   ✅ Products: ${stats.products.created} created, ${stats.products.updated} updated`)

    // 4. Sync Customers
    const customers = await deploy.customer.findMany()
    for (const customer of customers) {
      const existing = await local.customer.findUnique({ where: { id: customer.id } })
      const outletId = mapper.resolve('outlet', customer.outletId)
      if (existing) {
        await local.customer.update({
          where: { id: customer.id },
          data: { name: customer.name, whatsapp: customer.whatsapp, totalSpend: customer.totalSpend, points: customer.points },
        })
        stats.customers.updated++
      } else {
        await local.customer.create({
          data: { id: customer.id, name: customer.name, whatsapp: customer.whatsapp, totalSpend: customer.totalSpend, points: customer.points, outletId },
        })
        stats.customers.created++
      }
      mapper.set('customer', customer.id, customer.id)
    }
    console.log(`   ✅ Customers: ${stats.customers.created} created, ${stats.customers.updated} updated`)

    // 5. Sync Promos
    const promos = await deploy.promo.findMany()
    for (const promo of promos) {
      const existing = await local.promo.findUnique({ where: { id: promo.id } })
      const outletId = mapper.resolve('outlet', promo.outletId)
      if (existing) {
        await local.promo.update({
          where: { id: promo.id },
          data: { name: promo.name, type: promo.type, value: promo.value, minPurchase: promo.minPurchase, maxDiscount: promo.maxDiscount, active: promo.active },
        })
        stats.promos.updated++
      } else {
        await local.promo.create({
          data: { id: promo.id, name: promo.name, type: promo.type, value: promo.value, minPurchase: promo.minPurchase, maxDiscount: promo.maxDiscount, active: promo.active, outletId },
        })
        stats.promos.created++
      }
    }
    console.log(`   ✅ Promos: ${stats.promos.created} created, ${stats.promos.updated} updated`)

    // 6. Sync Outlet Settings
    const settings = await deploy.outletSetting.findMany()
    for (const setting of settings) {
      const existing = await local.outletSetting.findUnique({ where: { id: setting.id } })
      const outletId = mapper.resolve('outlet', setting.outletId)
      if (existing) {
        await local.outletSetting.update({
          where: { id: setting.id },
          data: {
            paymentMethods: setting.paymentMethods, loyaltyEnabled: setting.loyaltyEnabled,
            loyaltyPointsPerAmount: setting.loyaltyPointsPerAmount, loyaltyPointValue: setting.loyaltyPointValue,
            receiptBusinessName: setting.receiptBusinessName, receiptAddress: setting.receiptAddress,
            receiptPhone: setting.receiptPhone, receiptFooter: setting.receiptFooter,
            receiptLogo: setting.receiptLogo, themePrimaryColor: setting.themePrimaryColor,
          },
        })
        stats.settings.updated++
      } else {
        await local.outletSetting.create({
          data: {
            id: setting.id, outletId, paymentMethods: setting.paymentMethods,
            loyaltyEnabled: setting.loyaltyEnabled, loyaltyPointsPerAmount: setting.loyaltyPointsPerAmount,
            loyaltyPointValue: setting.loyaltyPointValue, receiptBusinessName: setting.receiptBusinessName,
            receiptAddress: setting.receiptAddress, receiptPhone: setting.receiptPhone,
            receiptFooter: setting.receiptFooter, receiptLogo: setting.receiptLogo,
            themePrimaryColor: setting.themePrimaryColor,
          },
        })
        stats.settings.created++
      }
    }
    console.log(`   ✅ Settings: ${stats.settings.created} created, ${stats.settings.updated} updated`)

    // 7. Sync Crew Permissions
    const permissions = await deploy.crewPermission.findMany()
    for (const perm of permissions) {
      const existing = await local.crewPermission.findUnique({ where: { id: perm.id } })
      const userId = mapper.resolve('user', perm.userId)
      const outletId = mapper.resolve('outlet', perm.outletId)
      if (existing) {
        await local.crewPermission.update({
          where: { id: perm.id },
          data: { userId, pages: perm.pages, outletId },
        })
        stats.permissions.updated++
      } else {
        await local.crewPermission.create({
          data: { id: perm.id, userId, pages: perm.pages, outletId },
        })
        stats.permissions.created++
      }
    }
    console.log(`   ✅ Permissions: ${stats.permissions.created} created, ${stats.permissions.updated} updated`)

    // 8. Sync Transactions + Items (batched)
    const transactions = await deploy.transaction.findMany({
      orderBy: { createdAt: 'asc' },
      include: { items: true },
    })
    const BATCH_SIZE = 50

    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const batch = transactions.slice(i, i + BATCH_SIZE)
      await local.$transaction(async (tx) => {
        for (const txn of batch) {
          const existing = await tx.transaction.findUnique({ where: { invoiceNumber: txn.invoiceNumber } })
          if (existing) {
            stats.transactions.skipped++
            continue
          }

          const outletId = mapper.resolve('outlet', txn.outletId)
          const userId = mapper.resolve('user', txn.userId)
          const customerId = txn.customerId ? mapper.resolve('customer', txn.customerId) : null

          await tx.transaction.create({
            data: {
              id: txn.id,
              invoiceNumber: txn.invoiceNumber,
              subtotal: txn.subtotal,
              discount: txn.discount,
              pointsUsed: txn.pointsUsed,
              total: txn.total,
              paymentMethod: txn.paymentMethod,
              paidAmount: txn.paidAmount,
              change: txn.change,
              note: txn.note,
              outletId,
              userId,
              customerId,
              createdAt: txn.createdAt,
              items: {
                create: txn.items.map((item) => ({
                  id: item.id,
                  productId: mapper.resolve('product', item.productId),
                  productName: item.productName,
                  price: item.price,
                  qty: item.qty,
                  subtotal: item.subtotal,
                  hpp: item.hpp,
                })),
              },
            },
          })
          stats.transactions.created++
        }
      })

      const processed = Math.min(i + BATCH_SIZE, transactions.length)
      console.log(`   📦 Transactions: ${processed}/${transactions.length} processed...`)
    }
    console.log(`   ✅ Transactions: ${stats.transactions.created} created, ${stats.transactions.skipped} skipped (duplicates)`)

  } finally {
    await deploy.$disconnect()
    await local.$disconnect()
  }

  console.log('\n🎉 Pull complete!')
  return stats
}
