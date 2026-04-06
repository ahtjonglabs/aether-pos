import { NextRequest } from 'next/server'
import { getAuthUser, unauthorized } from '@/lib/get-auth'
import * as XLSX from 'xlsx'
import { safeJsonError } from '@/lib/safe-response'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return unauthorized()
    }

    // Create template workbook
    const wb = XLSX.utils.book_new()

    // === Sheet 1: Data Produk ===
    const productData = [
      ['NAMA PRODUK*', 'SKU', 'HPP (Rp)', 'HARGA JUAL* (Rp)', 'QTY / STOK', 'SATUAN', 'KATEGORI', 'PUNYA VARIAN'],
      ['Nasi Goreng Spesial', 'SKU-001', 10000, 25000, 50, 'porsi', 'Makanan', 'tidak'],
      ['Es Teh Manis', 'SKU-002', 3000, 8000, 100, 'gelas', 'Minuman', 'tidak'],
      ['Ayam Geprek', 'SKU-003', 12000, 20000, 30, 'porsi', 'Makanan', 'tidak'],
      ['Kopi Susu Gula Aren', 'SKU-004', 5000, 15000, 80, 'gelas', 'Minuman', 'ya'],
      ['Mie Goreng', 'SKU-005', 8000, 18000, 40, 'porsi', 'Makanan', 'tidak'],
    ]

    const ws = XLSX.utils.aoa_to_sheet(productData)

    // Set column widths
    ws['!cols'] = [
      { wch: 30 }, // Nama Produk
      { wch: 15 }, // SKU
      { wch: 15 }, // HPP
      { wch: 20 }, // Harga Jual
      { wch: 14 }, // Qty / Stok
      { wch: 12 }, // Satuan
      { wch: 15 }, // Kategori
      { wch: 15 }, // Punya Varian
    ]

    // Add data validation (dropdown) for Punya Varian column (H2:H1000)
    const dvVariant = {
      type: 'list',
      allowBlank: true,
      sqref: 'H2:H1000',
      formulas: ['"ya,tidak"'],
    }
    ws['!dataValidation'] = [dvVariant]

    XLSX.utils.book_append_sheet(wb, ws, 'Produk')

    // === Sheet 2: Panduan (Instructions) ===
    const guideData = [
      ['PANDUAN IMPORT PRODUK — AETHER POS'],
      [''],
      ['KOLOM', 'DESKRIPSI', 'CONTOH', 'WAJIB?'],
      ['NAMA PRODUK', 'Nama produk yang akan ditambahkan', 'Nasi Goreng Spesial', 'Ya *'],
      ['SKU', 'Kode unik produk (opsional)', 'SKU-001', 'Tidak'],
      ['HPP (Rp)', 'Harga Pokok Penjualan / Modal', '10000', 'Tidak'],
      ['HARGA JUAL (Rp)', 'Harga jual ke customer', '25000', 'Ya *'],
      ['QTY / STOK', 'Jumlah stok awal', '50', 'Tidak'],
      ['SATUAN', 'Unit produk (lihat daftar satuan di bawah)', 'porsi', 'Tidak'],
      ['KATEGORI', 'Nama kategori (auto-create jika belum ada)', 'Makanan', 'Tidak'],
      ['PUNYA VARIAN', 'Apakah produk memiliki varian? Isi "ya" atau "tidak"', 'ya', 'Tidak'],
      [''],
      ['DAFTAR SATUAN YANG TERSEDIA:'],
      ['pcs, ml, lt, gr, kg, box, pack, botol, gelas, mangkuk, porsi, bungkus, sachet, dus, rim, lembar, meter, cm, ons'],
      [''],
      ['CATATAN:'],
      ['• Kolom bertanda * wajib diisi'],
      ['• Maksimal 500 baris per upload'],
      ['• Jika Nama Produk sudah ada, baris tersebut akan dilewati (skip)'],
      ['• Kategori baru akan otomatis dibuat jika belum ada di sistem'],
      ['• Harga harus dalam format angka tanpa titik/koma (contoh: 25000, bukan 25.000)'],
      ['• Untuk produk dengan varian, isi kolom "Punya Varian" = "ya", lalu tambahkan varian via menu Edit Produk di aplikasi'],
    ]

    const wsGuide = XLSX.utils.aoa_to_sheet(guideData)
    wsGuide['!cols'] = [
      { wch: 25 },
      { wch: 50 },
      { wch: 25 },
      { wch: 10 },
    ]

    XLSX.utils.book_append_sheet(wb, wsGuide, 'Panduan')

    // === Sheet 3: Varian Produk (Instructions) ===
    const variantData = [
      ['Panduan Upload Varian Produk'],
      [''],
      ['Langkah:'],
      ['1. Upload produk utama terlebih dahulu melalui sheet "Produk"'],
      ['2. Setel "Punya Varian" = ya di sheet Produk untuk produk yang memiliki varian'],
      ['3. Setel Harga Jual dan Stok produk utama = harga terendah / total stok semua varian'],
      ['4. Gunakan menu "Edit Produk" di aplikasi untuk menambahkan varian secara manual'],
      [''],
      ['Atau upload varian melalui sheet ini (opsional):'],
      ['Nama Produk', 'Nama Varian', 'SKU Varian', 'HPP', 'Harga Jual', 'Stok'],
      ['Nasi Goreng', 'Original', 'SKU-001-A', 10000, 25000, 50],
      ['Nasi Goreng', 'Spesial', 'SKU-001-B', 15000, 30000, 30],
      ['Es Teh', 'Manis', 'SKU-002-A', 2000, 8000, 100],
      ['Es Teh', 'Less Sugar', 'SKU-002-B', 2000, 8000, 80],
    ]
    const wsVariants = XLSX.utils.aoa_to_sheet(variantData)
    wsVariants['!cols'] = [
      { wch: 25 }, // Nama Produk
      { wch: 20 }, // Nama Varian
      { wch: 18 }, // SKU Varian
      { wch: 12 }, // HPP
      { wch: 15 }, // Harga Jual
      { wch: 8 },  // Stok
    ]
    XLSX.utils.book_append_sheet(wb, wsVariants, 'Varian Produk')

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // Return as downloadable file
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
