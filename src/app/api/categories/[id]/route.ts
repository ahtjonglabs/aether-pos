import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'

// PUT /api/categories/[id] — update a category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) return unauthorized()
    const { id } = await params

    const body = await request.json()
    const { name, color } = body

    // Verify ownership
    const existing = await db.category.findFirst({
      where: { id, outletId: user.outletId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Check unique name if changing
    if (name && name.trim() !== existing.name) {
      const duplicate = await db.category.findFirst({
        where: { name: name.trim(), outletId: user.outletId },
      })
      if (duplicate) {
        return NextResponse.json({ error: 'Category name already exists' }, { status: 400 })
      }
    }

    const updated = await db.category.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(color && { color }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Categories PUT error:', error)
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}

// DELETE /api/categories/[id] — delete a category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) return unauthorized()
    const { id } = await params

    // Verify ownership
    const existing = await db.category.findFirst({
      where: { id, outletId: user.outletId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Set products in this category to uncategorized (null categoryId)
    await db.product.updateMany({
      where: { categoryId: id },
      data: { categoryId: null },
    })

    await db.category.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Categories DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}
