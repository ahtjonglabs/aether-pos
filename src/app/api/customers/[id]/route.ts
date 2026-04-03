import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { db } from '@/lib/db'

export async function PUT(
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

    const existing = await db.customer.findFirst({
      where: { id, outletId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, whatsapp } = body

    // If whatsapp is being changed, check uniqueness
    if (whatsapp && whatsapp !== existing.whatsapp) {
      const whatsappExists = await db.customer.findUnique({
        where: { whatsapp },
      })
      if (whatsappExists) {
        return NextResponse.json(
          { error: 'WhatsApp number already registered' },
          { status: 400 }
        )
      }
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (whatsapp !== undefined) updateData.whatsapp = whatsapp

    // L3: Track changes for audit log
    const changes: Record<string, { from: unknown; to: unknown }> = {}
    if (name !== undefined && name !== existing.name) changes.name = { from: existing.name, to: name }
    if (whatsapp !== undefined && whatsapp !== existing.whatsapp) changes.whatsapp = { from: existing.whatsapp, to: whatsapp }

    const customer = await db.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id },
        data: updateData,
      })

      if (Object.keys(changes).length > 0) {
        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'CUSTOMER',
            entityId: id,
            details: JSON.stringify({ customerName: updated.name, changes }),
            outletId,
            userId,
          },
        })
      }

      return updated
    })

    return NextResponse.json(customer)
  } catch (error) {
    console.error('Customer PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update customer' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    const existing = await db.customer.findFirst({
      where: { id, outletId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // L3: Audit log before delete
    await db.auditLog.create({
      data: {
        action: 'DELETE',
        entityType: 'CUSTOMER',
        entityId: id,
        details: JSON.stringify({
          customerName: existing.name,
          whatsapp: existing.whatsapp,
        }),
        outletId,
        userId,
      },
    })

    await db.customer.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Customer DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete customer' },
      { status: 500 }
    )
  }
}
