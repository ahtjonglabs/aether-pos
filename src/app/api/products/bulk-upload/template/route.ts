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

    // Headers with sample data
    const data = [
      ['Nama*', 'SKU', 'HPP', 'Harga Jual*', 'Stok', 'Satuan', 'Kategori'],
      ['Nasi Goreng Spesial', 'SKU-001', 10000, 25000, 50, 'porsi', 'Makanan'],
      ['Es Teh Manis', 'SKU-002', 3000, 8000, 100, 'gelas', 'Minuman'],
      ['Ayam Geprek', 'SKU-003', 12000, 20000, 30, 'porsi', 'Makanan'],
    ]

    const ws = XLSX.utils.aoa_to_sheet(data)

    // Set column widths
    ws['!cols'] = [
      { wch: 25 }, // Nama
      { wch: 15 }, // SKU
      { wch: 12 }, // HPP
      { wch: 15 }, // Harga Jual
      { wch: 8 },  // Stok
      { wch: 12 }, // Satuan
      { wch: 15 }, // Kategori
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Produk')

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
