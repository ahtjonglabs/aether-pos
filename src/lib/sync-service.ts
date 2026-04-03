/**
 * sync-service.ts
 *
 * Handles downloading Products, Customers, and Promos from the server
 * and storing them in IndexedDB (Dexie) as the offline-first data source.
 *
 * Flow:
 *  1. App opens → check connection
 *  2. Online → fetch all products/customers/promos → bulkPut into IndexedDB
 *  3. User searches → reads from IndexedDB (instant, offline-capable)
 *  4. Offline → data is already cached, search still works
 */

import { localDB } from './local-db'
import type { CachedProduct, CachedCustomer, CachedPromo } from './local-db'

// ==================== SYNC FUNCTIONS ====================

/**
 * Download ALL products from server (paginated) and save to IndexedDB.
 * Replaces entire local cache (full overwrite).
 */
export async function syncProductsFromServer(): Promise<{
  success: boolean
  count: number
  error?: string
}> {
  try {
    const allProducts: CachedProduct[] = []
    let page = 1
    const limit = 200
    let hasMore = true

    while (hasMore) {
      const res = await fetch(`/api/products?limit=${limit}&page=${page}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()
      const products: CachedProduct[] = (data.products || []).map(
        (p: Record<string, unknown>) => ({
          id: p.id as string,
          name: p.name as string,
          sku: (p.sku as string) || null,
          barcode: (p.barcode as string) || null,
          hpp: Number(p.hpp) || 0,
          price: Number(p.price) || 0,
          bruto: Number(p.bruto) || 0,
          netto: Number(p.netto) || 0,
          stock: Number(p.stock) || 0,
          lowStockAlert: Number(p.lowStockAlert) || 10,
          image: (p.image as string) || null,
          updatedAt: p.updatedAt || new Date().toISOString(),
        })
      )

      allProducts.push(...products)

      // Check if there are more pages
      const totalPages = data.totalPages || 1
      hasMore = page < totalPages
      page++
    }

    await localDB.products.clear()
    if (allProducts.length > 0) {
      await localDB.products.bulkPut(allProducts)
    }

    // Record sync timestamp
    await localDB.syncMeta.put({
      key: 'lastProductSync',
      value: Date.now(),
    })

    return { success: true, count: allProducts.length }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, count: 0, error: message }
  }
}

/**
 * Download ALL customers from server (paginated) and save to IndexedDB.
 */
export async function syncCustomersFromServer(): Promise<{
  success: boolean
  count: number
  error?: string
}> {
  try {
    const allCustomers: CachedCustomer[] = []
    let page = 1
    const limit = 200
    let hasMore = true

    while (hasMore) {
      const res = await fetch(`/api/customers?limit=${limit}&page=${page}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()
      const customers: CachedCustomer[] = (data.customers || []).map(
        (c: Record<string, unknown>) => ({
          id: c.id as string,
          name: c.name as string,
          whatsapp: c.whatsapp as string,
          points: Number(c.points) || 0,
          totalSpend: Number(c.totalSpend) || 0,
          updatedAt: c.updatedAt || new Date().toISOString(),
        })
      )

      allCustomers.push(...customers)

      const totalPages = data.totalPages || 1
      hasMore = page < totalPages
      page++
    }

    await localDB.customers.clear()
    if (allCustomers.length > 0) {
      await localDB.customers.bulkPut(allCustomers)
    }

    await localDB.syncMeta.put({
      key: 'lastCustomerSync',
      value: Date.now(),
    })

    return { success: true, count: allCustomers.length }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, count: 0, error: message }
  }
}

/**
 * Download all promos from server and save to IndexedDB.
 */
export async function syncPromosFromServer(): Promise<{
  success: boolean
  count: number
  error?: string
}> {
  try {
    const res = await fetch('/api/settings/promos')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = await res.json()
    const promos: CachedPromo[] = (data.promos || []).map(
      (p: Record<string, unknown>) => ({
        id: p.id as string,
        name: p.name as string,
        type: p.type as string,
        value: Number(p.value) || 0,
        minPurchase: p.minPurchase ? Number(p.minPurchase) : null,
        maxDiscount: p.maxDiscount ? Number(p.maxDiscount) : null,
        active: Boolean(p.active),
        updatedAt: p.updatedAt || new Date().toISOString(),
      })
    )

    await localDB.promos.clear()
    if (promos.length > 0) {
      await localDB.promos.bulkPut(promos)
    }

    await localDB.syncMeta.put({
      key: 'lastPromoSync',
      value: Date.now(),
    })

    return { success: true, count: promos.length }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, count: 0, error: message }
  }
}

// ==================== MASTER SYNC ====================

/**
 * Sync all master data (products, customers, promos) in parallel.
 * Called on app open when online.
 */
export interface SyncAllResult {
  products: { success: boolean; count: number; error?: string }
  customers: { success: boolean; count: number; error?: string }
  promos: { success: boolean; count: number; error?: string }
}

export async function syncAllData(): Promise<SyncAllResult> {
  const [products, customers, promos] = await Promise.all([
    syncProductsFromServer(),
    syncCustomersFromServer(),
    syncPromosFromServer(),
  ])

  return { products, customers, promos }
}

// ==================== HELPERS ====================

/**
 * Get the last sync timestamp for a given key.
 */
export async function getLastSyncTime(
  key: string
): Promise<number | null> {
  const meta = await localDB.syncMeta.get(key)
  return meta ? meta.value : null
}

/**
 * Get all last sync timestamps.
 */
export async function getAllSyncTimes(): Promise<{
  products: number | null
  customers: number | null
  promos: number | null
}> {
  const [products, customers, promos] = await Promise.all([
    getLastSyncTime('lastProductSync'),
    getLastSyncTime('lastCustomerSync'),
    getLastSyncTime('lastPromoSync'),
  ])
  return { products, customers, promos }
}

/**
 * Check if IndexedDB has any cached data (first time sync check).
 */
export async function hasCachedData(): Promise<boolean> {
  const productCount = await localDB.products.count()
  return productCount > 0
}
