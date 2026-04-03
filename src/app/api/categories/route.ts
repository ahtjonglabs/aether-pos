import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'

// GET /api/categories — list all categories for the outlet
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return unauthorized()

    const categories = await db.category.findMany({
      where: { outletId: user.outletId },
      orderBy: [{ name: 'asc' }],
      include: {
        _count: { select: { products: true } },
      },
    })

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Categories GET error:', error)
    return NextResponse.json({ error: 'Failed to load categories' }, { status: 500 })
  }
}

// POST /api/categories — create a new category
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return unauthorized()

    const body = await request.json()
    const { name, color } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    // Check unique name per outlet
    const existing = await db.category.findFirst({
      where: { name: name.trim(), outletId: user.outletId },
    })
    if (existing) {
      return NextResponse.json({ error: 'Category name already exists' }, { status: 400 })
    }

    const category = await db.category.create({
      data: {
        name: name.trim(),
        color: color || 'zinc',
        outletId: user.outletId,
      },
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error('Categories POST error:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
