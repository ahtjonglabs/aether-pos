import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { safeJson, safeJsonError } from '@/lib/safe-response'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return unauthorized()
    }

    // Fix NULL hasVariants for products created before the variant feature was added
    const result = await db.$executeRaw`UPDATE Product SET "hasVariants" = 0 WHERE "hasVariants" IS NULL`

    // Prisma returns the count of updated rows
    const count = Number(result) || 0

    return safeJson({
      migrated: count,
      message: count > 0
        ? `Fixed ${count} product(s) with NULL hasVariants`
        : 'No products needed migration',
    })
  } catch (error) {
    console.error('Product migration error:', error)
    return safeJsonError('Migration failed')
  }
}
