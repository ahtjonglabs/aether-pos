import { NextRequest } from 'next/server'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import * as XLSX from 'xlsx'
import { safeJsonError } from '@/lib/safe-response'

// ── Unified unit list (must match bulk-upload route) ──────────────────
const VALID_UNITS = [
  'pcs', 'ml', 'lt', 'liter', 'gr', 'gram', 'kg',
  'box', 'pack', 'botol', 'gelas', 'mangkuk', 'porsi', 'bungkus',
  'sachet', 'dus', 'rim', 'lembar', 'meter', 'cm', 'ons',
  'lusin', 'set', 'pasang', 'kaleng', 'batang', 'butir', 'buah', 'ekor',
  'kapsul', 'tablet', 'tube',
]

// ── Template column headers ───────────────────────────────────────────
const HEADERS = [
  'Nama Produk *',
  'Kategori',
  'Nama Varian',
  'SKU',
  'HPP',
  'Harga Jual *',
  'Stok',
  'Satuan',
]

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return unauthorized()
    }

    const wb = XLSX.utils.book_new()

    // ─────────────────────────────────────────────
    // Sheet 1: Produk (data entry)
    // ─────────────────────────────────────────────
    const sheetData: (string | number)[][] = [
      // Row 1: Title
      ['TEMPLATE UPLOAD PRODUK - AETHER POS'],
      // Row 2: Subtitle / instructions
      ['Isi data produk di bawah. Kolom bertanda (*) wajib diisi. Hapus baris contoh sebelum mengisi.'],
      // Row 3: Empty separator
      [],
      // Row 4: Column headers
      HEADERS,
      // Row 5-8: Example — Variant product (T-Shirt Premium with S/M/L/XL)
      [
        'T-Shirt Premium',   // Nama Produk
        'Pakaian',           // Kategori
        'S',                 // Nama Varian
        'TS-S',              // SKU
        50000,               // HPP
        120000,              // Harga Jual
        50,                  // Stok
        'pcs',               // Satuan
      ],
      [
        'T-Shirt Premium',
        'Pakaian',
        'M',
        'TS-M',
        55000,
        130000,
        40,
        'pcs',
      ],
      [
        'T-Shirt Premium',
        'Pakaian',
        'L',
        'TS-L',
        60000,
        140000,
        30,
        'pcs',
      ],
      // Row 9: Example — Simple product (no variant)
      [
        'Nasi Goreng Spesial',  // Nama Produk
        'Makanan',              // Kategori
        '',                     // Nama Varian (kosong = produk tanpa varian)
        'SKU-001',              // SKU
        10000,                  // HPP
        25000,                  // Harga Jual
        50,                     // Stok
        'porsi',                // Satuan
      ],
      // Row 10: Example — Another simple product
      [
        'Es Teh Manis',
        'Minuman',
        '',
        '',
        3000,
        8000,
        100,
        'gelas',
      ],
      // Row 11: Empty separator
      [],
      // Row 12-15: Example — Another variant product (Kopi Susu with size variants)
      [
        'Kopi Susu',
        'Minuman',
        'Small',
        'KS-S',
        8000,
        18000,
        30,
        'gelas',
      ],
      [
        'Kopi Susu',
        'Minuman',
        'Medium',
        'KS-M',
        10000,
        22000,
        25,
        'gelas',
      ],
      [
        'Kopi Susu',
        'Minuman',
        'Large',
        'KS-L',
        13000,
        28000,
        20,
        'gelas',
      ],
    ]

    const ws = XLSX.utils.aoa_to_sheet(sheetData)

    // Column widths
    ws['!cols'] = [
      { wch: 28 }, // Nama Produk
      { wch: 16 }, // Kategori
      { wch: 18 }, // Nama Varian
      { wch: 16 }, // SKU
      { wch: 14 }, // HPP
      { wch: 16 }, // Harga Jual
      { wch: 10 }, // Stok
      { wch: 12 }, // Satuan
    ]

    // Merge title row (A1:H1)
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }, // Title
      { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }, // Subtitle
    ]

    // Data validation: dropdown for Satuan column (H5:H1000)
    // Header is at row 4 (0-indexed: 3), data starts at row 5 (0-indexed: 4)
    const dv = {
      type: 'list',
      allowBlank: true,
      sqref: 'H5:H1000',
      formulas: [`"${VALID_UNITS.join(',')}"`],
    }
    ws['!dataValidation'] = [dv]

    XLSX.utils.book_append_sheet(wb, ws, 'Produk')

    // ─────────────────────────────────────────────
    // Sheet 2: Panduan (Guide)
    // ─────────────────────────────────────────────
    const guideData: (string | number)[][] = [
      // Title
      ['PANDUAN UPLOAD PRODUK'],
      [''],
      // Section 1: Penjelasan Kolom
      ['═══════════════════════════════════════════════════'],
      ['1. PENJELASAN KOLOM'],
      ['═══════════════════════════════════════════════════'],
      [''],
      ['Nama Produk *'], ['  Nama produk yang akan dibuat. Wajib diisi.'],
      ['  Beberapa baris dengan nama yang sama = produk dengan varian.'],
      [''],
      ['Kategori'], ['  Kategori produk (opsional). Akan dibuat otomatis jika belum ada.'],
      [''],
      ['Nama Varian'], ['  Nama varian, misalnya: S, M, L, XL atau Merah, Biru, Hijau.'],
      ['  Jika dikosongkan = produk tanpa varian (produk sederhana).'],
      [''],
      ['SKU'], ['  Kode SKU unik untuk produk atau varian (opsional).'],
      [''],
      ['HPP'], ['  Harga Pokok Produksi / Modal (opsional, default: 0).'],
      [''],
      ['Harga Jual *'], ['  Harga jual produk atau varian. Wajib diisi, harus lebih dari 0.'],
      [''],
      ['Stok'], ['  Jumlah stok awal (opsional, default: 0).'],
      [''],
      ['Satuan'], ['  Satuan produk, misalnya: pcs, porsi, gelas, kg (opsional, default: pcs).'],
      [''],
      // Section 2: Cara Kerja Varian
      ['═══════════════════════════════════════════════════'],
      ['2. CARA KERJA VARIAN'],
      ['═══════════════════════════════════════════════════'],
      [''],
      ['Produk dengan Varian:'],
      ['  • Tulis nama produk yang SAMA pada beberapa baris.'],
      ['  • Isi kolom "Nama Varian" pada setiap baris (S, M, L, XL, dll).'],
      ['  • Setiap baris varian boleh memiliki SKU, HPP, Harga, dan Stok sendiri.'],
      ['  • Harga jual varian pertama akan dijadikan harga dasar produk.'],
      ['  • Stok produk induk akan otomatis diisi 0 (stok diatur per varian).'],
      [''],
      ['Produk Tanpa Varian (Sederhana):'],
      ['  • Tulis nama produk dan KOSONGKAN kolom "Nama Varian".'],
      ['  • Hanya perlu satu baris per produk.'],
      [''],
      // Section 3: Contoh
      ['═══════════════════════════════════════════════════'],
      ['3. CONTOH'],
      ['═══════════════════════════════════════════════════'],
      [''],
      ['Contoh Produk dengan Varian:'],
      ['  Nama Produk      | Kategori | Nama Varian | SKU   | HPP   | Harga  | Stok | Satuan'],
      ['  ─────────────────────────────────────────────────────────────────────────────────'],
      ['  Kaos Polos        | Pakaian  | S           | KP-S  | 40000 | 89000  | 100  | pcs'],
      ['  Kaos Polos        | Pakaian  | M           | KP-M  | 42000 | 99000  | 80   | pcs'],
      ['  Kaos Polos        | Pakaian  | L           | KP-L  | 45000 | 109000 | 60   | pcs'],
      [''],
      ['Contoh Produk Sederhana:'],
      ['  Nama Produk      | Kategori | Nama Varian | SKU   | HPP   | Harga  | Stok | Satuan'],
      ['  ─────────────────────────────────────────────────────────────────────────────────'],
      ['  Mie Goreng        | Makanan  | (kosong)    | MG-01 | 7000  | 15000  | 50   | porsi'],
      [''],
      // Section 4: Ketentuan
      ['═══════════════════════════════════════════════════'],
      ['4. KETENTUAN'],
      ['═══════════════════════════════════════════════════'],
      [''],
      ['  • Format angka bisa menggunakan format Indonesia (25.000) atau standar (25000).'],
      ['  • Nama produk tidak boleh sama dengan produk yang sudah ada (case-insensitive).'],
      ['  • Nama varian harus unik dalam satu produk.'],
      ['  • Maksimal 500 baris data per upload.'],
      ['  • Ukuran file maksimal 5 MB.'],
      ['  • Format file: .xlsx, .xls, atau .csv.'],
      ['  • Jangan ubah baris judul (baris ke-4) dan header kolom.'],
      [''],
      ['  • Hapus semua baris contoh sebelum mengisi data Anda.'],
      [''],
      // Section 5: Daftar Satuan
      ['═══════════════════════════════════════════════════'],
      ['5. DAFTAR SATUAN YANG TERSEDIA'],
      ['═══════════════════════════════════════════════════'],
      [''],
      ...VALID_UNITS.map(u => [u]),
    ]

    const wsGuide = XLSX.utils.aoa_to_sheet(guideData)
    wsGuide['!cols'] = [{ wch: 80 }]
    wsGuide['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } },
    ]
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Panduan')

    // ─────────────────────────────────────────────
    // Generate & return
    // ─────────────────────────────────────────────
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="template-produk-aether-pos.xlsx"',
      },
    })
  } catch (error) {
    console.error('Template download error:', error)
    return safeJsonError('Gagal mengunduh template')
  }
}
