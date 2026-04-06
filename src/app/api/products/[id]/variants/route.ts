import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { safeJson, safeJsonCreated, safeJsonError } from '@/lib/safe-response'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return unauthorized()
    }
    const outletId = user.outletId

    const { id } = await params

    // Verify product belongs to this outlet
    const product = await db.product.findFirst({
      where: { id, outletId },
      select: { id: true, hasVariants: true },
    })
    if (!product) {
      return safeJsonError('Product not found', 404)
    }

    const variants = await db.productVariant.findMany({
      where: { productId: id, outletId },
      orderBy: { createdAt: 'asc' },
    })

    return safeJson({ variants })
  } catch (error) {
    console.error('Variants GET error:', error)
    return safeJsonError('Failed to load variants')
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return unauthorized()
    }
    const outletId = user.outletId
    const userId = user.id

    const { id } = await params

    // Verify product belongs to this outlet
    const product = await db.product.findFirst({
      where: { id, outletId },
    })
    if (!product) {
      return safeJsonError('Product not found', 404)
    }

    const body = await request.json()
    const { name, sku, price, hpp, stock, lowStockAlert } = body

    if (!name || price === undefined || price === null) {
      return safeJsonError('Variant name and price are required', 400)
    }

    // Check unique name per product
    const existing = await db.productVariant.findFirst({
      where: { name, productId: id },
    })
    if (existing) {
      return safeJsonError('Variant name already exists for this product', 400)
    }

    const variant = await db.productVariant.create({
      data: {
        name,
        sku: sku || null,
        price: Number(price),
        hpp: Number(hpp) || 0,
        stock: Number(stock) || 0,
        lowStockAlert: Number(lowStockAlert) || 10,
        productId: id,
        outletId,
      },
    })

    // Fire-and-forget audit log
    const { safeAuditLog } = await import('@/lib/safe-audit')
    safeAuditLog({
      action: 'UPDATE',
      entityType: 'PRODUCT',
      entityId: id,
      details: JSON.stringify({
        productName: product.name,
        changes: { variantAdded: { name, price } },
      }),
      outletId,
      userId,
    }).catch(() => {})

    return safeJsonCreated(variant)
  } catch (error) {
    console.error('Variants POST error:', error)
    return safeJsonError('Failed to create variant')
  }
}
