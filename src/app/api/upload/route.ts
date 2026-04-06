import { NextRequest } from 'next/server'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { safeJson, safeJsonError } from '@/lib/safe-response'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

export const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return unauthorized()

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return safeJsonError('File tidak ditemukan', 400)
    }

    if (file.size > MAX_FILE_SIZE) {
      return safeJsonError('Ukuran file maksimal 2MB', 400)
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return safeJsonError('Format file tidak didukung. Gunakan JPG, PNG, GIF, atau WebP.', 400)
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'png'
    const filename = `logo-${user.outletId}-${randomUUID().slice(0, 8)}.${ext}`

    // Ensure upload directory exists
    const uploadDir = join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadDir, { recursive: true })

    // Write file
    const filepath = join(uploadDir, filename)
    await writeFile(filepath, buffer)

    // Return URL
    const url = `/uploads/${filename}`

    return safeJson({ url, filename })
  } catch (error) {
    console.error('[upload] Error:', error)
    return safeJsonError('Gagal mengupload file')
  }
}
