'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogDescription, ResponsiveDialogFooter } from '@/components/ui/responsive-dialog'
import { Loader2, Plus, Trash2, GripVertical, Layers } from 'lucide-react'

interface Product {
  id: string
  name: string
  sku: string | null
  hpp: number
  price: number
  stock: number
  lowStockAlert: number
  image: string | null
  categoryId: string | null
  unit: string
  hasVariants?: boolean
  variants?: ProductVariant[]
}

interface ProductVariant {
  id?: string
  name: string
  sku?: string | null
  price: number
  hpp: number
  stock: number
  lowStockAlert: number
}

interface Category {
  id: string
  name: string
  color: string
  _count?: { products: number }
}

interface ProductFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  onSaved: () => void
}

export default function ProductFormDialog({ open, onOpenChange, product, onSaved }: ProductFormDialogProps) {
  const { data: session } = useSession()
  const isOwner = session?.user?.role === 'OWNER'
  const isEdit = !!product

  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const UNITS = ['pcs', 'ml', 'lt', 'gr', 'kg', 'box', 'pack', 'botol', 'gelas', 'mangkuk', 'porsi', 'bungkus', 'sachet', 'dus', 'rim', 'lembar', 'meter', 'cm', 'ons']

  const [form, setForm] = useState({
    name: '',
    sku: '',
    hpp: '',
    price: '',
    stock: '',
    lowStockAlert: '10',
    image: '',
    categoryId: '',
    unit: 'pcs',
    hasVariants: false,
  })

  const [variants, setVariants] = useState<ProductVariant[]>([])

  useEffect(() => {
    if (open) {
      // Fetch categories
      fetch('/api/categories')
        .then((res) => res.json())
        .then((data) => setCategories(data.categories || []))
        .catch(() => {})
    }
  }, [open])

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        sku: product.sku || '',
        hpp: String(product.hpp),
        price: String(product.price),
        stock: String(product.stock),
        lowStockAlert: String(product.lowStockAlert),
        image: product.image || '',
        categoryId: product.categoryId || '',
        unit: product.unit || 'pcs',
        hasVariants: product.hasVariants || false,
      })
      setVariants(product.variants || [])
    } else {
      setForm({
        name: '',
        sku: '',
        hpp: '',
        price: '',
        stock: '',
        lowStockAlert: '10',
        image: '',
        categoryId: '',
        unit: 'pcs',
        hasVariants: false,
      })
      setVariants([])
    }
  }, [product, open])

  // Add a new empty variant
  const addVariant = () => {
    setVariants((prev) => [
      ...prev,
      { name: '', sku: '', price: 0, hpp: 0, stock: 0, lowStockAlert: 10 },
    ])
  }

  // Remove a variant by index
  const removeVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index))
  }

  // Update a variant field by index
  const updateVariant = (index: number, field: keyof ProductVariant, value: string | number) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    )
  }

  // Toggle hasVariants
  const toggleHasVariants = (checked: boolean) => {
    setForm((prev) => ({ ...prev, hasVariants: checked }))
    if (!checked) {
      setVariants([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.price) {
      toast.error('Product name and price are required')
      return
    }

    // Validate variants if hasVariants is on
    if (form.hasVariants) {
      if (variants.length === 0) {
        toast.error('Tambahkan minimal 1 varian')
        return
      }
      for (const v of variants) {
        if (!v.name.trim()) {
          toast.error('Nama varian wajib diisi')
          return
        }
        if (!v.price || v.price <= 0) {
          toast.error(`Harga varian "${v.name}" wajib diisi`)
          return
        }
      }
      // Check duplicate variant names
      const names = variants.map((v) => v.name.trim().toLowerCase())
      const uniqueNames = new Set(names)
      if (uniqueNames.size !== names.length) {
        toast.error('Nama varian harus unik')
        return
      }
    }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        sku: form.sku || null,
        hpp: isOwner ? Number(form.hpp) || 0 : 0,
        price: Number(form.price),
        stock: Number(form.stock) || 0,
        lowStockAlert: Number(form.lowStockAlert) || 10,
        image: form.image || null,
        categoryId: form.categoryId || null,
        unit: form.unit || 'pcs',
        hasVariants: form.hasVariants,
      }

      if (form.hasVariants && isEdit) {
        // When editing with variants, send the full variants array for bulk replacement
        body.variants = variants.map((v) => ({
          name: v.name.trim(),
          sku: v.sku || null,
          price: Number(v.price),
          hpp: Number(v.hpp) || 0,
          stock: Number(v.stock) || 0,
          lowStockAlert: Number(v.lowStockAlert) || 10,
        }))
      } else if (form.hasVariants && !isEdit) {
        body.variants = variants.map((v) => ({
          name: v.name.trim(),
          sku: v.sku || null,
          price: Number(v.price),
          hpp: Number(v.hpp) || 0,
          stock: Number(v.stock) || 0,
          lowStockAlert: Number(v.lowStockAlert) || 10,
        }))
      }

      const url = isEdit ? `/api/products/${product.id}` : '/api/products'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success(isEdit ? 'Product updated' : 'Product created')
        onOpenChange(false)
        onSaved()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to save product')
      }
    } catch {
      toast.error('Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="bg-zinc-900 border-zinc-800 p-4 max-h-[90vh] overflow-y-auto" desktopClassName="max-w-2xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="text-sm font-semibold text-zinc-100">
            {isEdit ? 'Edit Product' : 'Add Product'}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-300">Product Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="Enter product name"
              required
              className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-300">Category</Label>
            <select
              value={form.categoryId}
              onChange={(e) => updateField('categoryId', e.target.value)}
              className="w-full h-9 text-sm bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md px-3 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">No Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-300">SKU</Label>
            <Input
              value={form.sku}
              onChange={(e) => updateField('sku', e.target.value)}
              placeholder="SKU-001"
              className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
            />
          </div>

          {/* Variant Toggle */}
          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-800/60 border border-zinc-700/60">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-violet-500/10 flex items-center justify-center">
                <Layers className="h-3.5 w-3.5 text-violet-400" />
              </div>
              <div>
                <Label className="text-xs font-medium text-zinc-200">Produk dengan Varian</Label>
                <p className="text-[10px] text-zinc-500">Aktifkan jika produk punya variasi ukuran, warna, dll</p>
              </div>
            </div>
            <Switch
              checked={form.hasVariants}
              onCheckedChange={toggleHasVariants}
              className="data-[state=checked]:bg-emerald-500"
            />
          </div>

          {/* When variants are OFF: show normal single price/stock/HPP fields */}
          {!form.hasVariants && (
            <>
              {isOwner && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300">Harga Pokok (HPP)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={form.hpp}
                    onChange={(e) => updateField('hpp', e.target.value)}
                    placeholder="0"
                    className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300">Harga Jual *</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={form.price}
                  onChange={(e) => updateField('price', e.target.value)}
                  placeholder="0"
                  required
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300">Satuan</Label>
                <select
                  value={form.unit}
                  onChange={(e) => updateField('unit', e.target.value)}
                  className="w-full h-9 text-sm bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md px-3 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300">Stock</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={(e) => updateField('stock', e.target.value)}
                    placeholder="0"
                    className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300">Low Stock Alert</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.lowStockAlert}
                    onChange={(e) => updateField('lowStockAlert', e.target.value)}
                    placeholder="10"
                    className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
                  />
                </div>
              </div>
            </>
          )}

          {/* When variants are ON: show variant manager */}
          {form.hasVariants && (
            <div className="space-y-3">
              {/* Base price (still required for display) */}
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300">Harga Jual Dasar *</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={form.price}
                  onChange={(e) => updateField('price', e.target.value)}
                  placeholder="0"
                  required
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
                />
                <p className="text-[10px] text-zinc-500">Harga default jika varian belum ditentukan</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300">Satuan</Label>
                <select
                  value={form.unit}
                  onChange={(e) => updateField('unit', e.target.value)}
                  className="w-full h-9 text-sm bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md px-3 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              {/* Variant Manager */}
              <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2.5 bg-zinc-800/80 border-b border-zinc-700/60">
                  <span className="text-xs font-semibold text-zinc-300">
                    Varian ({variants.length})
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addVariant}
                    className="h-7 text-[11px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-2"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Tambah Varian
                  </Button>
                </div>

                <div className="max-h-64 overflow-y-auto">
                  {variants.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Layers className="h-8 w-8 text-zinc-700 mb-2" />
                      <p className="text-xs text-zinc-500">Belum ada varian</p>
                      <p className="text-[10px] text-zinc-600 mt-1">Klik &quot;Tambah Varian&quot; untuk menambahkan</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-800/60">
                      {variants.map((variant, index) => (
                        <div key={index} className="p-3 space-y-2 group">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <GripVertical className="h-3 w-3 text-zinc-600" />
                              <span className="text-[10px] text-zinc-500 font-medium">#{index + 1}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeVariant(index)}
                              className="h-6 w-6 p-0 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="col-span-2 sm:col-span-1">
                              <Label className="text-[10px] text-zinc-400">Nama *</Label>
                              <Input
                                value={variant.name}
                                onChange={(e) => updateVariant(index, 'name', e.target.value)}
                                placeholder="e.g., S, M, L, XL"
                                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 h-8 text-xs"
                              />
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                              <Label className="text-[10px] text-zinc-400">SKU</Label>
                              <Input
                                value={variant.sku || ''}
                                onChange={(e) => updateVariant(index, 'sku', e.target.value)}
                                placeholder="SKU varian"
                                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 h-8 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] text-zinc-400">Harga *</Label>
                              <Input
                                type="number"
                                min="0"
                                step="any"
                                value={variant.price || ''}
                                onChange={(e) => updateVariant(index, 'price', Number(e.target.value))}
                                placeholder="0"
                                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 h-8 text-xs"
                              />
                            </div>
                            {isOwner && (
                              <div>
                                <Label className="text-[10px] text-zinc-400">HPP</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={variant.hpp || ''}
                                  onChange={(e) => updateVariant(index, 'hpp', Number(e.target.value))}
                                  placeholder="0"
                                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 h-8 text-xs"
                                />
                              </div>
                            )}
                            <div>
                              <Label className="text-[10px] text-zinc-400">Stock</Label>
                              <Input
                                type="number"
                                min="0"
                                value={variant.stock || ''}
                                onChange={(e) => updateVariant(index, 'stock', Number(e.target.value))}
                                placeholder="0"
                                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 h-8 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] text-zinc-400">Low Stock</Label>
                              <Input
                                type="number"
                                min="0"
                                value={variant.lowStockAlert || ''}
                                onChange={(e) => updateVariant(index, 'lowStockAlert', Number(e.target.value))}
                                placeholder="10"
                                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 h-8 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-300">Image URL</Label>
            <Input
              value={form.image}
              onChange={(e) => updateField('image', e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
            />
          </div>

          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-emerald-500 hover:bg-emerald-600 text-white h-8 text-xs"
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {isEdit ? 'Update' : 'Create'}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
