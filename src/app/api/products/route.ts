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

    // Enrich products with variant count
    const productIds = (products as Array<{ id: string }>).map((p) => p.id)
    const variantCounts = await db.productVariant.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds } },
      _count: { id: true },
    })
    const variantCountMap = new Map(
      variantCounts.map((v) => [v.productId, v._count.id])
    )

    products = (products as Array<Record<string, unknown>>).map((p) => ({
      ...p,
      _variantCount: variantCountMap.get(p.id) || 0,
    }))

    // Analytics stats (computed on all products in outlet, not filtered)
    const [totalCount, categoryCount, statsProducts] = await Promise.all([
      db.product.count({ where: { outletId } }),
      db.category.count({ where: { outletId } }),
      db.product.findMany({
        where: { outletId },
        select: { id: true, price: true, stock: true, lowStockAlert: true, hasVariants: true },
      }),
    ])

    // For products with variants, sum up variant stocks
    const variantProducts = statsProducts.filter((p) => p.hasVariants)
    const variantStockMap = new Map<string, { stock: number; lowStock: number }>()
    if (variantProducts.length > 0) {
      const vIds = variantProducts.map((p) => p.id)
      const allVariants = await db.productVariant.findMany({
        where: { productId: { in: vIds } },
        select: { productId: true, stock: true, lowStockAlert: true },
      })
      for (const v of allVariants) {
        const existing = variantStockMap.get(v.productId) || { stock: 0, lowStock: 0 }
        variantStockMap.set(v.productId, {
          stock: existing.stock + v.stock,
          lowStock: v.stock <= v.lowStockAlert && v.stock >= 0 ? existing.lowStock + 1 : existing.lowStock,
        })
      }
    }

    let lowStockCount = 0
    let totalInventoryValue = 0
    for (const p of statsProducts) {
      if (p.hasVariants && variantStockMap.has(p.id)) {
        const vInfo = variantStockMap.get(p.id)!
        lowStockCount += vInfo.lowStock
        totalInventoryValue += Number(p.price) * vInfo.stock
      } else {
        if (p.stock <= p.lowStockAlert && p.stock >= 0) lowStockCount++
        totalInventoryValue += Number(p.price) * p.stock
      }
    }

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
    const { name, sku, hpp, price, stock, lowStockAlert, image, categoryId, unit, hasVariants, variants } = body

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

    // Validate variants if hasVariants is true
    if (hasVariants && variants && variants.length > 0) {
      const variantNames = new Set<string>()
      for (const v of variants) {
        if (!v.name || v.price === undefined || v.price === null) {
          return safeJsonError('Each variant must have a name and price', 400)
        }
        if (variantNames.has(v.name)) {
          return safeJsonError(`Duplicate variant name: ${v.name}`, 400)
        }
        variantNames.add(v.name)
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
          hasVariants: hasVariants || false,
          outletId,
        },
      })

      // Create variants if provided
      if (hasVariants && variants && variants.length > 0) {
        await tx.productVariant.createMany({
          data: variants.map((v: Record<string, unknown>) => ({
            name: v.name as string,
            sku: (v.sku as string) || null,
            price: Number(v.price),
            hpp: Number(v.hpp) || 0,
            stock: Number(v.stock) || 0,
            lowStockAlert: Number(v.lowStockAlert) || 10,
            productId: newProduct.id,
            outletId,
          })),
        })
      }

      await tx.auditLog.create({
        data: {
          action: 'CREATE',
          entityType: 'PRODUCT',
          entityId: newProduct.id,
          details: JSON.stringify({
            name: newProduct.name,
            price: newProduct.price,
            stock: newProduct.stock,
            hasVariants: newProduct.hasVariants,
            variantCount: variants?.length || 0,
          }),
          outletId,
          userId,
        },
      })

      return newProduct
    })

    // Fetch created variants to return
    const createdVariants = hasVariants
      ? await db.productVariant.findMany({
          where: { productId: product.id, outletId },
          orderBy: { createdAt: 'asc' },
        })
      : []

    return safeJsonCreated({ ...product, variants: createdVariants })
  } catch (error) {
    console.error('Products POST error:', error)
    return safeJsonError('Failed to create product')
  }
}
