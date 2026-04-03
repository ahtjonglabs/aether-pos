import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { getPlanFeatures, isUnlimited } from '@/lib/plan-config'

const PAGE_SIZE = 20

type SortOption = 'newest' | 'best-selling' | 'low-stock' | 'most-stock'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return unauthorized()
    }
    const outletId = user.outletId

    const { searchParams } = request.nextUrl
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || PAGE_SIZE))
    const search = searchParams.get('search') || ''
    const sort: SortOption = (searchParams.get('sort') as SortOption) || 'newest'
    const categoryId = searchParams.get('categoryId') || ''

    const skip = (page - 1) * limit

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

// M1: Raw SQL for best-selling — uses parameterized queries with proper type
// NOTE: This uses SQLite syntax. For PostgreSQL, the parameter format differs ($1, $2).
// The db.ts switcher handles this, but the SQL itself is SQLite-specific.
// Fallback to Prisma-level sort if PostgreSQL is detected.
    const dbProvider = process.env.DATABASE_PROVIDER || 'sqlite'

    if (sort === 'best-selling') {
      if (dbProvider === 'postgresql') {
        // PostgreSQL fallback: aggregate in JS after fetching products with relations
        // This avoids raw SQL portability issues
        const allProducts = await db.product.findMany({
          where,
          include: {
            category: { select: { id: true, name: true, color: true } },
            transactionItems: {
              select: { qty: true },
            },
          },
        })

        // Calculate totalSold for each product and sort
        const withSold = allProducts.map((p: Record<string, unknown>) => ({
          ...p,
          totalSold: Array.isArray(p.transactionItems)
            ? (p.transactionItems as Array<{ qty: number }>).reduce((s: number, ti: { qty: number }) => s + ti.qty, 0)
            : 0,
        }))
        withSold.sort((a: { totalSold: number }, b: { totalSold: number }) => b.totalSold - a.totalSold)

        total = withSold.length
        // Remove transactionItems from response, strip totalSold
        products = withSold
          .slice(skip, skip + limit)
          .map(({ totalSold: _ts, transactionItems: _ti, ...rest }: Record<string, unknown>) => rest)
      } else {
        // SQLite: Use raw SQL for best-selling sort
        const rawProducts = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(`
          SELECT p.*, COALESCE(SUM(ti.qty), 0) as totalSold,
            c.id as "categoryId", c.name as "categoryName", c.color as "categoryColor"
          FROM Product p
          LEFT JOIN TransactionItem ti ON ti.productId = p.id
          LEFT JOIN Category c ON c.id = p.categoryId
          WHERE p.outletId = ?
          ${search ? 'AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)' : ''}
          ${categoryId ? 'AND p.categoryId = ?' : ''}
          GROUP BY p.id
          ORDER BY totalSold DESC
          LIMIT ? OFFSET ?
        `,
          outletId,
          search ? `%${search}%` : '',
          search ? `%${search}%` : '',
          search ? `%${search}%` : '',
          ...(categoryId ? [categoryId] : []),
          limit,
          skip
        )

        // Get total count
        total = await db.product.count({ where })

        // Normalize raw products to include category object and remove extra fields
        products = rawProducts.map(({ totalSold: _ts, categoryName, categoryColor, ...rest }: Record<string, unknown>) => {
          const product: Record<string, unknown> = { ...rest }
          if (rest.categoryId) {
            product.category = {
              id: rest.categoryId,
              name: categoryName,
              color: categoryColor,
            }
          } else {
            product.category = null
          }
          return product
        })
      }
    } else {
      let orderBy: Record<string, string> = { createdAt: 'desc' }

      if (sort === 'low-stock') {
        orderBy = { stock: 'asc' }
      } else if (sort === 'most-stock') {
        orderBy = { stock: 'desc' }
      }
      // sort === 'newest' uses default createdAt: 'desc'

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

    return NextResponse.json({
      products,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Products GET error:', error)
    return NextResponse.json(
      { error: 'Failed to load products' },
      { status: 500 }
    )
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
    const { name, sku, hpp, price, bruto, netto, stock, lowStockAlert, image, categoryId, unit } = body

    if (!name || price === undefined || price === null) {
      return NextResponse.json(
        { error: 'Product name and price are required' },
        { status: 400 }
      )
    }

    // K3: Dynamic product limit based on plan
    const outlet = await db.outlet.findUnique({
      where: { id: outletId },
      select: { accountType: true },
    })
    const accountType = outlet?.accountType?.startsWith('suspended:')
      ? outlet.accountType.replace('suspended:', '')
      : (outlet?.accountType || 'free')
    const features = getPlanFeatures(accountType)

    if (!isUnlimited(features.maxProducts)) {
      const count = await db.product.count({ where: { outletId } })
      if (count >= features.maxProducts) {
        return NextResponse.json(
          { error: `Batas produk untuk paket ${accountType} sudah tercapai (${features.maxProducts}). Upgrade ke Pro untuk produk unlimited!` },
          { status: 400 }
        )
      }
    }

    // Check unique name per outlet
    const existing = await db.product.findFirst({
      where: { name, outletId },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'Product name already exists in this outlet' },
        { status: 400 }
      )
    }

    // Validate categoryId if provided
    if (categoryId) {
      const category = await db.category.findFirst({
        where: { id: categoryId, outletId },
      })
      if (!category) {
        return NextResponse.json({ error: 'Category not found' }, { status: 400 })
      }
    }

    const product = await db.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          name,
          sku: sku || null,
          hpp: hpp || 0,
          price,
          bruto: bruto || 0,
          netto: netto || 0,
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

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('Products POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
}
