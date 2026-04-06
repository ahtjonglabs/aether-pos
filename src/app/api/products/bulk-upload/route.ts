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

// ============================================================
// Number Parsing Helper — Handles Indonesian & US formats
// ============================================================

/**
 * Parse a value into a number, handling:
 * - Raw JS numbers: 25000 → 25000
 * - Indonesian format: "25.000" → 25000 (dot = thousand sep)
 * - US format: "25,000" → 25000 (comma = thousand sep)
 * - Mixed with currency: "Rp 25.000" → 25000, "Rp25,000" → 25000
 * - Decimal: "25.500,50" → 25500.50 (ID), "25,500.50" → 25500.50 (US)
 */
function parseNum(val: unknown): number {
  if (typeof val === 'number') return val
  if (!val) return 0

  const str = String(val).trim()
  if (!str) return 0

  // Remove currency symbols & whitespace
  let cleaned = str.replace(/[Rp$\s]/gi, '')

  // Detect format: if both comma and dot exist
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // "25.500,50" (Indonesian) → remove dots, replace comma with dot
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      // "25,500.50" (US) → remove commas
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (cleaned.includes('.')) {
    // "25.000" → could be Indonesian (25000) or decimal (25.0)
    // Heuristic: if 3 digits after last dot, treat as thousand sep
    const lastDot = cleaned.lastIndexOf('.')
    const afterDot = cleaned.substring(lastDot + 1)
    if (afterDot.length === 3) {
      cleaned = cleaned.replace(/\./g, '')
    }
    // Otherwise treat as decimal (e.g., "25.50")
  } else if (cleaned.includes(',')) {
    // "25,000" → remove commas (thousand sep)
    cleaned = cleaned.replace(/,/g, '')
  }

  const num = Number(cleaned)
  return isNaN(num) ? 0 : num
}

// ============================================================
// Case-insensitive column value getter
// ============================================================

function getCol(row: Record<string, unknown>, ...keys: string[]): unknown {
  const lower = new Map<string, unknown>()
  for (const [k, v] of Object.entries(row)) {
    lower.set(k.toLowerCase().replace(/\*+$/, '').trim(), v)
  }
  for (const key of keys) {
    const val = lower.get(key.toLowerCase())
    if (val !== undefined && val !== null && String(val).trim() !== '') return val
  }
  return ''
}

// ============================================================
// POST: Bulk Upload
// ============================================================

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

    // Parse file
    let workbook: XLSX.WorkBook
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' })
    } catch (parseError) {
      console.error('Excel parse error:', parseError)
      return safeJsonError('File tidak dapat dibaca. Pastikan file adalah format Excel/CSV yang valid.', 400)
    }

    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return safeJsonError('File kosong — tidak ada sheet/data', 400)
    }
    const sheet = workbook.Sheets[sheetName]

    // Use raw: true to get actual number values from Excel
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

    // Filter out completely empty rows
    const rows = rawRows.filter(row =>
      Object.values(row).some(v => v !== undefined && v !== null && String(v).trim() !== '')
    )

    console.log('[bulk-upload] Parsed', rows.length, 'rows from file:', file.name)
    if (rows.length > 0) {
      console.log('[bulk-upload] Columns:', Object.keys(rows[0]))
      console.log('[bulk-upload] First row sample:', JSON.stringify(rows[0]).substring(0, 300))
    }

    if (rows.length === 0) {
      return safeJsonError('File tidak memiliki data baris. Pastikan baris pertama adalah header kolom.', 400)
    }

    if (rows.length > MAX_ROWS) {
      return safeJsonError(`Maksimal ${MAX_ROWS} baris per upload. File Anda memiliki ${rows.length} baris.`, 400)
    }

    // Check product limit ONCE before processing
    let currentProductCount = 0
    const maxProducts = outletPlan.features.maxProducts
    if (!isUnlimited(maxProducts)) {
      currentProductCount = await db.product.count({ where: { outletId } })
      if (currentProductCount >= maxProducts) {
        return safeJsonError(`Batas produk untuk paket ${outletPlan.plan} sudah tercapai (${maxProducts}).`, 400)
      }
    }

    // Cache categories & existing product names to minimize DB queries
    const categoryCache = new Map<string, string | null>()
    const existingNames = new Set<string>()

    // Pre-fetch all existing product names for this outlet (much faster than N queries)
    const existingProducts = await db.product.findMany({
      where: { outletId },
      select: { name: true },
    })
    for (const p of existingProducts) {
      existingNames.add(p.name.toLowerCase().trim())
    }

    // Process rows in a transaction
    let created = 0
    let skipped = 0
    const errors: string[] = []

    await db.$transaction(async (tx) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const rowNum = i + 2 // Excel rows start at 1, header is row 1

        // Map column names (case-insensitive flexible matching)
        const name = String(getCol(row, 'Nama', 'Nama Produk', 'Nama Barang', 'Product Name', 'Product', 'name', 'NAME')).trim()
        const sku = String(getCol(row, 'SKU', 'Kode', 'Kode Produk', 'sku', 'Code')).trim() || null
        const hpp = parseNum(getCol(row, 'HPP', 'Harga Pokok', 'Cost', 'Modal', 'hpp', 'harga_pokok', 'Harga Modal'))
        const price = parseNum(getCol(row, 'Harga Jual', 'Harga', 'Price', 'harga_jual', 'harga', 'price', 'PRICE', 'Sell Price', 'Jual'))
        const stock = parseNum(getCol(row, 'Stok', 'Stock', 'Qty', 'Quantity', 'stock', 'stok', 'Jumlah'))
        const unitRaw = String(getCol(row, 'Satuan', 'Unit', 'satuan', 'unit') || 'pcs').trim().toLowerCase()
        const categoryRaw = String(getCol(row, 'Kategori', 'Kategori Produk', 'Category', 'kategori', 'category')).trim()

        // Validate required fields
        if (!name) {
          errors.push(`Baris ${rowNum}: Nama produk wajib diisi`)
          continue
        }

        if (!price || price <= 0) {
          errors.push(`Baris ${rowNum}: Harga Jual harus lebih dari 0 (Nama: ${name}, nilai: "${getCol(row, 'Harga Jual', 'Harga', 'Price')}")`)
          continue
        }

        const unit = VALID_UNITS.includes(unitRaw) ? unitRaw : 'pcs'
        const hppVal = Math.max(0, hpp)
        const stockVal = Math.max(0, Math.round(stock))

        // Check product limit
        if (!isUnlimited(maxProducts)) {
          if (currentProductCount + created >= maxProducts) {
            errors.push(`Baris ${rowNum}: Batas produk (${maxProducts}) sudah tercapai, upload dihentikan`)
            break
          }
        }

        // Skip duplicates (by name + outletId, case-insensitive)
        if (existingNames.has(name.toLowerCase().trim())) {
          skipped++
          continue
        }

        // Auto-create category if needed (with cache)
        let categoryId: string | null = null
        if (categoryRaw) {
          if (categoryCache.has(categoryRaw)) {
            categoryId = categoryCache.get(categoryRaw)!
          } else {
            const existingCategory = await tx.category.findFirst({
              where: { name: categoryRaw, outletId },
            })
            if (existingCategory) {
              categoryId = existingCategory.id
              categoryCache.set(categoryRaw, categoryId)
            } else {
              const newCategory = await tx.category.create({
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
        await tx.product.create({
          data: {
            name,
            sku,
            hpp: hppVal,
            price,
            stock: stockVal,
            unit,
            categoryId,
            outletId,
          },
        })

        // Track newly created name to avoid duplicates within same upload
        existingNames.add(name.toLowerCase().trim())
        created++
      }
    }, { timeout: 30000 })

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
          fileName: file.name,
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
    return safeJsonError('Gagal memproses file upload', 500)
  }
}
