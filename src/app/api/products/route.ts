import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { parsePagination, resolvePlanType } from '@/lib/api-helpers'
import { getPlanFeatures, isUnlimited } from '@/lib/plan-config'
import { safeJson, safeJsonCreated, safeJsonError } from '@/lib/safe-response'

type SortOption = 'newest' | 'best-selling' | 'low-stock' | 'most-stock'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return unauthorized()
    }
    const outletId = user.outletId

    const { searchParams } = request.nextUrl
    const { page, limit, skip } = parsePagination(searchParams)
    const search = searchParams.get('search') || ''
    const sort: SortOption = (searchParams.get('sort') as SortOption) || 'newest'
    const categoryId = searchParams.get('categoryId') || ''

    const where: Record<string, unknown> = { outletId }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
      ]
    }
    if (categoryId) {
      where.categoryId = categoryId
    }

    let products: unknown[]
    let total: number

    if (sort === 'best-selling') {
      // Use aggregation instead of loading all transaction items
      const soldAgg = await db.transactionItem.groupBy({
        by: ['productId'],
        where: { transaction: { outletId } },
        _sum: { qty: true },
        _count: true,
      })

      const soldMap = new Map(
        soldAgg.map((s) => [s.productId, (s._sum.qty ?? 0)])
      )

      const [allProducts, count] = await Promise.all([
        db.product.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: {
            category: { select: { id: true, name: true, color: true } },
          },
        }),
        db.product.count({ where }),
      ])

      // Sort by totalSold descending
      allProducts.sort((a, b) => (soldMap.get(b.id) ?? 0) - (soldMap.get(a.id) ?? 0))

      total = count
      products = allProducts.slice(skip, skip + limit).map((p) => ({
        ...p,
        _totalSold: soldMap.get(p.id) ?? 0,
      }))
    } else {
      let orderBy: Record<string, string> = { createdAt: 'desc' }

      if (sort === 'low-stock') {
        orderBy = { stock: 'asc' }
      } else if (sort === 'most-stock') {
        orderBy = { stock: 'desc' }
      }

      const [result, count] = await Promise.all([
        db.product.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: {
            category: { select: { id: true, name: true, color: true } },
          },
        }),
        db.product.count({ where }),
      ])

      products = result
      total = count
    }

    // Analytics stats (computed on all products in outlet, not filtered)
    const [totalCount, categoryCount, statsProducts] = await Promise.all([
      db.product.count({ where: { outletId } }),
      db.category.count({ where: { outletId } }),
      db.product.findMany({
        where: { outletId },
        select: { price: true, stock: true, lowStockAlert: true },
      }),
    ])

    const lowStockCount = statsProducts.filter((p) => p.stock <= p.lowStockAlert && p.stock >= 0).length
    const totalInventoryValue = statsProducts.reduce((sum, p) => sum + (Number(p.price) * p.stock), 0)

    return safeJson({
      products,
      totalPages: Math.ceil(total / limit),
      stats: {
        total: totalCount,
        categories: categoryCount,
        lowStock: lowStockCount,
        inventoryValue: totalInventoryValue,
      },
    })
  } catch (error) {
    console.error('Products GET error:', error)
    return safeJsonError('Failed to load products')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return unauthorized()
    }
    const userId = user.id
    const outletId = user.outletId

    const body = await request.json()
    const { name, sku, hpp, price, stock, lowStockAlert, image, categoryId, unit } = body

    if (!name || price === undefined || price === null) {
      return safeJsonError('Product name and price are required', 400)
    }

    // Dynamic product limit based on plan
    const outlet = await db.outlet.findUnique({
      where: { id: outletId },
      select: { accountType: true },
    })
    const accountType = resolvePlanType(outlet?.accountType)
    const features = getPlanFeatures(accountType)

    if (!isUnlimited(features.maxProducts)) {
      const count = await db.product.count({ where: { outletId } })
      if (count >= features.maxProducts) {
        return safeJsonError(`Batas produk untuk paket ${accountType} sudah tercapai (${features.maxProducts}). Upgrade ke Pro untuk produk unlimited!`, 400)
      }
    }

    // Check unique name per outlet
    const existing = await db.product.findFirst({
      where: { name, outletId },
    })
    if (existing) {
      return safeJsonError('Product name already exists in this outlet', 400)
    }

    // Validate categoryId if provided
    if (categoryId) {
      const category = await db.category.findFirst({
        where: { id: categoryId, outletId },
      })
      if (!category) {
        return safeJsonError('Category not found', 400)
      }
    }

    const product = await db.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          name,
          sku: sku || null,
          hpp: hpp || 0,
          price,
          stock: stock || 0,
          lowStockAlert: lowStockAlert || 10,
          image: image || null,
          categoryId: categoryId || null,
          unit: unit || 'pcs',
          outletId,
        },
      })

      await tx.auditLog.create({
        data: {
          action: 'CREATE',
          entityType: 'PRODUCT',
          entityId: newProduct.id,
          details: JSON.stringify({
            name: newProduct.name,
            price: newProduct.price,
            stock: newProduct.stock,
          }),
          outletId,
          userId,
        },
      })

      return newProduct
    })

    return safeJsonCreated(product)
  } catch (error) {
    console.error('Products POST error:', error)
    return safeJsonError('Failed to create product')
  }
}
