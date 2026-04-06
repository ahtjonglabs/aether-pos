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

// Unified unit list (must match template route)
const VALID_UNITS = [
  'pcs', 'ml', 'lt', 'liter', 'gr', 'gram', 'kg',
  'box', 'pack', 'botol', 'gelas', 'mangkuk', 'porsi', 'bungkus',
  'sachet', 'dus', 'rim', 'lembar', 'meter', 'cm', 'ons',
  'lusin', 'set', 'pasang', 'kaleng', 'batang', 'butir', 'buah', 'ekor',
  'kapsul', 'tablet', 'tube',
]

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
// Parsed row interface
// ============================================================

interface ParsedRow {
  rowNum: number          // Excel row number for error messages
  name: string            // Product name
  variantName: string     // Variant name (empty = simple product row)
  sku: string | null
  hpp: number
  price: number
  stock: number
  unit: string
  categoryRaw: string
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

    // ── Parse all rows as arrays (header: 1 mode) ──
    // This allows us to find the header row dynamically,
    // supporting templates with instruction rows at the top.
    const allRows = XLSX.utils.sheet_to_json<(string | number | null | boolean)[]>(sheet, {
      header: 1,
      defval: '',
    })

    if (allRows.length === 0) {
      return safeJsonError('File kosong — tidak ada data', 400)
    }

    // ── Find the header row ──
    // Look for a row containing key column name "Nama Produk"
    let headerIdx = -1
    for (let i = 0; i < Math.min(allRows.length, 10); i++) { // Search only first 10 rows
      const row = allRows[i]
      const rowStr = row.map(c => String(c).toLowerCase().trim())
      if (rowStr.some(c => c.includes('nama produk') || c.includes('nama barang') || c.includes('product name'))) {
        headerIdx = i
        break
      }
    }

    if (headerIdx === -1) {
      return safeJsonError(
        'Header kolom tidak ditemukan. Pastikan file memiliki baris header dengan kolom "Nama Produk". ' +
        'Gunakan template terbaru dari menu "Unduh Template".',
        400,
      )
    }

    // Extract headers (strip * markers and trim)
    const headers = allRows[headerIdx].map(h =>
      String(h).replace(/\*+/g, '').trim(),
    )
    const colCount = headers.length

    // ── Build data rows as objects ──
    const rawRows = allRows.slice(headerIdx + 1)

    // Filter out empty rows and convert to objects
    const dataRows: Record<string, unknown>[] = []
    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i]
      // Skip completely empty rows
      if (!raw.some(cell => cell !== '' && cell !== null && cell !== undefined)) continue

      const obj: Record<string, unknown> = {}
      // Pad row to match header length
      while (raw.length < colCount) raw.push('')
      for (let c = 0; c < colCount; c++) {
        obj[headers[c]] = raw[c] ?? ''
      }
      dataRows.push(obj)
    }

    console.log('[bulk-upload] Parsed', dataRows.length, 'data rows from file:', file.name)
    if (dataRows.length > 0) {
      console.log('[bulk-upload] Headers:', headers)
      console.log('[bulk-upload] First row sample:', JSON.stringify(dataRows[0]).substring(0, 400))
    }

    if (dataRows.length === 0) {
      return safeJsonError('File tidak memiliki data baris. Pastikan baris pertama setelah header berisi data produk.', 400)
    }

    if (dataRows.length > MAX_ROWS) {
      return safeJsonError(`Maksimal ${MAX_ROWS} baris per upload. File Anda memiliki ${dataRows.length} baris.`, 400)
    }

    // ── Check product limit ONCE before processing ──
    let currentProductCount = 0
    const maxProducts = outletPlan.features.maxProducts
    if (!isUnlimited(maxProducts)) {
      currentProductCount = await db.product.count({ where: { outletId } })
      if (currentProductCount >= maxProducts) {
        return safeJsonError(`Batas produk untuk paket ${outletPlan.plan} sudah tercapai (${maxProducts}).`, 400)
      }
    }

    // ── Cache & lookups ──
    const categoryCache = new Map<string, string | null>()
    const existingNames = new Set<string>()

    // Pre-fetch all existing product names for this outlet
    const existingProducts = await db.product.findMany({
      where: { outletId },
      select: { name: true },
    })
    for (const p of existingProducts) {
      existingNames.add(p.name.toLowerCase().trim())
    }

    // ── Phase 1: Parse & validate all rows ──
    // Group rows by product name (case-insensitive)
    const productGroups = new Map<string, ParsedRow[]>()
    const errors: string[] = []
    let totalDataRows = dataRows.length

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]
      // Excel row number: headerIdx is 0-based, header is at headerIdx,
      // data starts at headerIdx + 1 (which is Excel row headerIdx + 2)
      // dataRows[0] = allRows[headerIdx + 1] = Excel row headerIdx + 2
      // dataRows[i] = Excel row headerIdx + 2 + i
      const rowNum = headerIdx + 2 + i

      // Map column names (case-insensitive flexible matching)
      const name = String(getCol(row, 'Nama Produk', 'Nama', 'Nama Barang', 'Product Name', 'Product', 'name', 'NAME')).trim()
      const variantName = String(getCol(row, 'Nama Varian', 'Varian', 'Variant', 'variant name', 'Ukuran', 'Size')).trim()
      const sku = String(getCol(row, 'SKU', 'Kode', 'Kode Produk', 'sku', 'Code')).trim() || null
      const hpp = parseNum(getCol(row, 'HPP', 'Harga Pokok', 'Cost', 'Modal', 'hpp', 'harga_pokok', 'Harga Modal'))
      const price = parseNum(getCol(row, 'Harga Jual', 'Harga', 'Price', 'harga_jual', 'harga', 'price', 'PRICE', 'Sell Price', 'Jual'))
      const stock = parseNum(getCol(row, 'Stok', 'Stock', 'Qty', 'Quantity', 'stock', 'stok', 'Jumlah'))
      const unitRaw = String(getCol(row, 'Satuan', 'Unit', 'satuan', 'unit') || 'pcs').trim().toLowerCase()
      const categoryRaw = String(getCol(row, 'Kategori', 'Kategori Produk', 'Category', 'kategori', 'category')).trim()

      // Validate required: product name
      if (!name) {
        errors.push(`Baris ${rowNum}: Nama produk wajib diisi`)
        continue
      }

      // Validate required: price (only for rows without variant name, or all variant rows)
      // We'll do full validation during processing, but catch obvious errors here
      if (!variantName && (!price || price <= 0)) {
        errors.push(`Baris ${rowNum}: Harga Jual harus lebih dari 0 (Nama: ${name})`)
        continue
      }

      const unit = VALID_UNITS.includes(unitRaw) ? unitRaw : 'pcs'
      const hppVal = Math.max(0, hpp)
      const stockVal = Math.max(0, Math.round(stock))

      const key = name.toLowerCase().trim()
      if (!productGroups.has(key)) {
        productGroups.set(key, [])
      }
      productGroups.get(key)!.push({
        rowNum,
        name,
        variantName,
        sku,
        hpp: hppVal,
        price,
        stock: stockVal,
        unit,
        categoryRaw,
      })
    }

    // ── Phase 2: Process product groups in a transaction ──
    let created = 0
    let createdVariants = 0
    let skipped = 0

    await db.$transaction(async (tx) => {
      for (const [key, groupRows] of productGroups) {
        const productName = groupRows[0].name

        // Skip duplicates (by name + outletId, case-insensitive)
        if (existingNames.has(key)) {
          skipped += groupRows.length
          continue
        }

        // Check product limit
        if (!isUnlimited(maxProducts)) {
          if (currentProductCount + created >= maxProducts) {
            errors.push(`Batas produk (${maxProducts}) sudah tercapai, upload dihentikan`)
            break
          }
        }

        // Determine if this is a variant product
        const variantRows = groupRows.filter(r => r.variantName)
        const isVariantProduct = variantRows.length > 0

        // Use first row's category for the product
        const categoryRaw = groupRows.find(r => r.categoryRaw)?.categoryRaw || ''
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

        if (isVariantProduct) {
          // ── Variant Product ──
          // Use first row's unit for the parent product
          const unit = groupRows[0].unit
          // Use first variant row's price as product base price (for display)
          const firstVariantRow = variantRows[0]
          const basePrice = firstVariantRow.price > 0 ? firstVariantRow.price : 0

          if (basePrice <= 0) {
            errors.push(`Baris ${firstVariantRow.rowNum}: Harga Jual varian "${firstVariantRow.variantName}" harus lebih dari 0`)
            continue
          }

          // Get SKU from a non-variant row if available, otherwise null
          const parentSku = groupRows.find(r => !r.variantName)?.sku || null

          // Create parent product with hasVariants: true
          const product = await tx.product.create({
            data: {
              name: productName,
              sku: parentSku,
              hpp: 0,
              price: basePrice,
              stock: 0,
              unit,
              categoryId,
              outletId,
              hasVariants: true,
            },
          })

          // Track variant names within this product to catch duplicates
          const variantNamesSeen = new Set<string>()

          // Create each variant
          for (const vr of variantRows) {
            // Validate variant price
            if (!vr.price || vr.price <= 0) {
              errors.push(`Baris ${vr.rowNum}: Harga Jual varian "${vr.variantName}" harus lebih dari 0 (diabaikan)`)
              continue
            }

            // Check duplicate variant name within this product
            const variantKey = vr.variantName.toLowerCase().trim()
            if (variantNamesSeen.has(variantKey)) {
              errors.push(`Baris ${vr.rowNum}: Nama varian "${vr.variantName}" duplikat dalam produk "${productName}" (diabaikan)`)
              continue
            }
            variantNamesSeen.add(variantKey)

            await tx.productVariant.create({
              data: {
                name: vr.variantName,
                sku: vr.sku,
                price: vr.price,
                hpp: vr.hpp,
                stock: vr.stock,
                lowStockAlert: 10,
                productId: product.id,
                outletId,
              },
            })
            createdVariants++
          }

          // Warn if there were non-variant rows mixed in
          const nonVariantRows = groupRows.filter(r => !r.variantName)
          if (nonVariantRows.length > 0) {
            for (const nvr of nonVariantRows) {
              errors.push(
                `Baris ${nvr.rowNum}: Baris tanpa "Nama Varian" pada produk "${productName} yang memiliki varian. ` +
                `Baris ini diabaikan — gunakan hanya baris dengan varian untuk produk bervariasi.`,
              )
            }
          }

          // Track newly created name
          existingNames.add(key)
          created++

        } else {
          // ── Simple Product (no variants) ──
          // Use first row's data
          const r = groupRows[0]

          if (!r.price || r.price <= 0) {
            // This should have been caught in Phase 1, but double-check
            errors.push(`Baris ${r.rowNum}: Harga Jual harus lebih dari 0 (Nama: ${r.name})`)
            continue
          }

          await tx.product.create({
            data: {
              name: productName,
              sku: r.sku,
              hpp: r.hpp,
              price: r.price,
              stock: r.stock,
              unit: r.unit,
              categoryId,
              outletId,
              hasVariants: false,
            },
          })

          // Warn if multiple rows for the same simple product
          if (groupRows.length > 1) {
            for (let gi = 1; gi < groupRows.length; gi++) {
              errors.push(
                `Baris ${groupRows[gi].rowNum}: Produk "${productName}" sudah terdaftar di baris ${groupRows[0].rowNum}. ` +
                `Untuk produk tanpa varian, cukup isi satu baris. Baris ini diabaikan.`,
              )
            }
          }

          // Track newly created name
          existingNames.add(key)
          created++
        }
      }
    }, { timeout: 30000 })

    // ── Audit log ──
    if (created > 0) {
      await safeAuditLog({
        action: 'CREATE',
        entityType: 'PRODUCT',
        details: JSON.stringify({
          bulkUpload: true,
          created,
          createdVariants,
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
      createdVariants,
      skipped,
      errors,
      totalRows: totalDataRows,
    })
  } catch (error) {
    console.error('Bulk upload error:', error)
    return safeJsonError('Gagal memproses file upload', 500)
  }
}
