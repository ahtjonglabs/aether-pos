import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import { getOutletPlan, isUnlimited } from '@/lib/plan-config'
import * as XLSX from 'xlsx'
import { safeAuditLog } from '@/lib/safe-audit'
import { safeJson, safeJsonError } from '@/lib/safe-response'

// Vercel serverless function timeout: 60s (default is 10s on Hobby plan)
export const maxDuration = 60

const MAX_ROWS = 500

const VALID_UNITS = ['pcs', 'ml', 'lt', 'gr', 'kg', 'box', 'pack', 'botol', 'gelas', 'mangkuk', 'porsi', 'bungkus', 'sachet', 'dus', 'rim', 'lembar', 'meter', 'cm', 'ons']

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return unauthorized()
    }
    const outletId = user.outletId
    const userId = user.id

    // Check plan: bulkUpload feature required
    const outletPlan = await getOutletPlan(outletId, db)
    if (!outletPlan) {
      return safeJsonError('Outlet not found', 404)
    }

    if (!outletPlan.features.bulkUpload) {
      return safeJsonError('Fitur bulk upload hanya tersedia untuk akun Pro. Upgrade untuk mengakses fitur ini.', 403)
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return safeJsonError('File tidak ditemukan', 400)
    }

    // Validate file type by extension (MIME type can be unreliable)
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      return safeJsonError('Format file tidak didukung. Gunakan .xlsx, .xls, atau .csv', 400)
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return safeJsonError('Ukuran file maksimal 5MB', 400)
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse Excel
    let workbook: XLSX.WorkBook
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' })
    } catch (parseError) {
      console.error('Excel parse error:', parseError)
      return safeJsonError('File tidak dapat dibaca. Pastikan file adalah format Excel (.xlsx/.xls) yang valid.', 400)
    }

    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return safeJsonError('File Excel kosong — tidak ada sheet', 400)
    }
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

    if (rows.length === 0) {
      return safeJsonError('File Excel tidak memiliki data baris', 400)
    }

    if (rows.length > MAX_ROWS) {
      return safeJsonError(`Maksimal ${MAX_ROWS} baris per upload. File Anda memiliki ${rows.length} baris.`, 400)
    }

    // Check product limit
    if (!isUnlimited(outletPlan.features.maxProducts)) {
      const currentCount = await db.product.count({ where: { outletId } })
      if (currentCount >= outletPlan.features.maxProducts) {
        return safeJsonError(`Batas produk untuk paket ${outletPlan.plan} sudah tercapai (${outletPlan.features.maxProducts}).`, 400)
      }
    }

    // Process rows
    let created = 0
    let skipped = 0
    const errors: string[] = []

    // Cache categories to reduce DB queries
    const categoryCache = new Map<string, string | null>()

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // Excel rows start at 1, header is row 1

      // Map column names (flexible matching)
      const name = String(row['Nama'] || row['nama'] || row['NAME'] || row['name'] || '').trim()
      const sku = String(row['SKU'] || row['sku'] || '').trim() || null
      const hppRaw = row['HPP'] || row['hpp'] || row['Harga Pokok'] || row['harga_pokok'] || 0
      const priceRaw = row['Harga Jual'] || row['harga_jual'] || row['Harga'] || row['harga'] || row['Price'] || row['price'] || 0
      const stockRaw = row['Stok'] || row['stok'] || row['Stock'] || row['stock'] || 0
      const unitRaw = String(row['Satuan'] || row['satuan'] || row['Unit'] || row['unit'] || 'pcs').trim().toLowerCase()
      const categoryRaw = String(row['Kategori'] || row['kategori'] || row['Category'] || row['category'] || '').trim()

      // Validate required fields
      if (!name) {
        errors.push(`Baris ${rowNum}: Nama produk wajib diisi`)
        continue
      }

      const price = Number(priceRaw)
      if (!price || price <= 0) {
        errors.push(`Baris ${rowNum}: Harga Jual harus lebih dari 0 (Nama: ${name})`)
        continue
      }

      const hpp = Number(hppRaw) || 0
      const stock = Number(stockRaw) || 0
      const unit = VALID_UNITS.includes(unitRaw) ? unitRaw : 'pcs'

      // Check product limit before each creation
      if (!isUnlimited(outletPlan.features.maxProducts)) {
        const currentCount = await db.product.count({ where: { outletId } })
        if (currentCount >= outletPlan.features.maxProducts) {
          errors.push(`Baris ${rowNum}: Batas produk sudah tercapai, sisa produk dihentikan`)
          break
        }
      }

      // Skip duplicates (by name + outletId)
      const existing = await db.product.findFirst({
        where: { name, outletId },
      })
      if (existing) {
        skipped++
        continue
      }

      // Auto-create category if needed (with cache)
      let categoryId: string | null = null
      if (categoryRaw) {
        if (categoryCache.has(categoryRaw)) {
          categoryId = categoryCache.get(categoryRaw)!
        } else {
          const existingCategory = await db.category.findFirst({
            where: { name: categoryRaw, outletId },
          })
          if (existingCategory) {
            categoryId = existingCategory.id
            categoryCache.set(categoryRaw, categoryId)
          } else {
            const newCategory = await db.category.create({
              data: {
                name: categoryRaw,
                outletId,
                color: 'zinc',
              },
            })
            categoryId = newCategory.id
            categoryCache.set(categoryRaw, categoryId)
          }
        }
      }

      // Create product
      await db.product.create({
        data: {
          name,
          sku,
          hpp,
          price,
          stock,
          unit,
          categoryId,
          outletId,
        },
      })

      created++
    }

    // Create audit log for bulk upload
    if (created > 0) {
      await safeAuditLog({
        action: 'CREATE',
        entityType: 'PRODUCT',
        details: JSON.stringify({
          bulkUpload: true,
          created,
          skipped,
          errors: errors.length,
        }),
        outletId,
        userId,
      })
    }

    return safeJson({
      created,
      skipped,
      errors,
    })
  } catch (error) {
    console.error('Bulk upload error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return safeJson({ error: 'Gagal memproses file upload', details: message }, 500)
  }
}
