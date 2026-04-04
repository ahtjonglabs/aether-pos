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
      ['NAMA PRODUK*', 'SKU', 'HPP (Rp)', 'HARGA JUAL* (Rp)', 'QTY / STOK', 'SATUAN', 'KATEGORI'],
      ['Nasi Goreng Spesial', 'SKU-001', 10000, 25000, 50, 'porsi', 'Makanan'],
      ['Es Teh Manis', 'SKU-002', 3000, 8000, 100, 'gelas', 'Minuman'],
      ['Ayam Geprek', 'SKU-003', 12000, 20000, 30, 'porsi', 'Makanan'],
      ['Kopi Susu Gula Aren', 'SKU-004', 5000, 15000, 80, 'gelas', 'Minuman'],
      ['Mie Goreng', 'SKU-005', 8000, 18000, 40, 'porsi', 'Makanan'],
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
    ]

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
    ]

    const wsGuide = XLSX.utils.aoa_to_sheet(guideData)
    wsGuide['!cols'] = [
      { wch: 25 },
      { wch: 50 },
      { wch: 25 },
      { wch: 10 },
    ]

    XLSX.utils.book_append_sheet(wb, wsGuide, 'Panduan')

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
