'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogDescription, ResponsiveDialogFooter } from '@/components/ui/responsive-dialog'
import { Loader2, Layers, Trash2, Plus } from 'lucide-react'

interface ProductVariant {
  id?: string
  name: string
  sku: string
  hpp: string
  price: string
  stock: string
}

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
  const [hasVariants, setHasVariants] = useState(false)
  const [variants, setVariants] = useState<ProductVariant[]>([])
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
  })

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
      })
      setHasVariants(!!product.hasVariants)
      if (product.variants && product.variants.length > 0) {
        setVariants(product.variants.map((v) => ({
          id: v.id,
          name: v.name || '',
          sku: v.sku || '',
          hpp: String(v.hpp || 0),
          price: String(v.price || ''),
          stock: String(v.stock || 0),
        })))
      } else if (product.hasVariants) {
        setVariants([{ name: '', sku: '', hpp: '', price: '', stock: '' }])
      } else {
        setVariants([])
      }
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
      })
      setHasVariants(false)
      setVariants([])
    }
  }, [product, open])

  useEffect(() => {
    if (open && product && product.hasVariants && (!product.variants || product.variants.length === 0)) {
      fetch(`/api/products/${product.id}/variants`)
        .then((res) => res.json())
        .then((data) => {
          if (data.variants && data.variants.length > 0) {
            setVariants(data.variants.map((v: any) => ({
              id: v.id,
              name: v.name || '',
              sku: v.sku || '',
              hpp: String(v.hpp || 0),
              price: String(v.price || ''),
              stock: String(v.stock || 0),
            })))
          }
        })
        .catch(() => {})
    }
  }, [open, product])

  const updateVariant = (index: number, key: keyof ProductVariant, value: string) => {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, [key]: value } : v)))
  }

  const addVariant = () => {
    setVariants((prev) => [...prev, { name: '', sku: '', hpp: '', price: '', stock: '' }])
  }

  const removeVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) {
      toast.error('Product name is required')
      return
    }
    if (hasVariants) {
      if (variants.length === 0) {
        toast.error('At least 1 variant is required')
        return
      }
      for (let i = 0; i < variants.length; i++) {
        if (!variants[i].name) {
          toast.error(`Variant ${i + 1}: name is required`)
          return
        }
        if (!variants[i].price || Number(variants[i].price) <= 0) {
          toast.error(`Variant ${i + 1}: price is required`)
          return
        }
      }
    } else if (!form.price) {
      toast.error('Product price is required')
      return
    }

    setSaving(true)
    try {
      const body: Record<string, any> = {
        name: form.name,
        sku: form.sku || null,
        hpp: isOwner ? Number(form.hpp) || 0 : 0,
        price: hasVariants ? 0 : Number(form.price),
        stock: hasVariants ? 0 : Number(form.stock) || 0,
        lowStockAlert: Number(form.lowStockAlert) || 10,
        image: form.image || null,
        categoryId: form.categoryId || null,
        unit: form.unit || 'pcs',
        hasVariants,
        variants: hasVariants
          ? variants.map((v) => ({
              name: v.name,
              sku: v.sku || null,
              hpp: Number(v.hpp) || 0,
              price: Number(v.price),
              stock: Number(v.stock) || 0,
            }))
          : [],
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
      <ResponsiveDialogContent className="bg-zinc-900 border-zinc-800 p-4 max-h-[90vh] overflow-y-auto" desktopClassName="max-w-lg">
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
            <Label className="text-xs text-zinc-300">
              Harga Jual {hasVariants ? '' : '*'}
            </Label>
            <Input
              type="number"
              min="0"
              step="any"
              value={form.price}
              onChange={(e) => updateField('price', e.target.value)}
              placeholder="0"
              disabled={hasVariants}
              required={!hasVariants}
              className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {hasVariants && <p className="text-[10px] text-zinc-500">Managed per variant</p>}
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
                disabled={hasVariants}
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {hasVariants && <p className="text-[10px] text-zinc-500">Per variant</p>}
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

          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-300">Image URL</Label>
            <Input
              value={form.image}
              onChange={(e) => updateField('image', e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
            />
          </div>

          {/* Variants Section */}
          <div className="space-y-2 pt-1 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-emerald-400" />
                <Label className="text-xs text-zinc-300 font-medium">Has Variants</Label>
              </div>
              <Switch
                checked={hasVariants}
                onCheckedChange={(checked) => {
                  setHasVariants(checked)
                  if (checked && variants.length === 0) {
                    setVariants([{ name: '', sku: '', hpp: '', price: '', stock: '' }])
                  } else if (!checked) {
                    setVariants([])
                  }
                }}
              />
            </div>
            {hasVariants && (
              <p className="text-[10px] text-zinc-500 -mt-1">When enabled, price and stock are managed per variant</p>
            )}
          </div>

          {hasVariants && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-zinc-300 font-medium flex items-center gap-1.5">
                  <Layers className="h-3 w-3 text-emerald-400" />
                  Variants
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addVariant}
                  className="h-6 text-[11px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-2"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Variant
                </Button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                {variants.map((variant, index) => (
                  <div key={index} className="bg-zinc-800/60 border border-zinc-700/60 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500 font-medium">Variant #{index + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVariant(index)}
                        disabled={variants.length <= 1}
                        className="h-5 w-5 p-0 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="space-y-1.5">
                      <Input
                        value={variant.name}
                        onChange={(e) => updateVariant(index, 'name', e.target.value)}
                        placeholder="Variant name *"
                        className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Input
                        value={variant.sku}
                        onChange={(e) => updateVariant(index, 'sku', e.target.value)}
                        placeholder="SKU (optional)"
                        className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-8 text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {isOwner && (
                        <div className="space-y-1.5">
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={variant.hpp}
                            onChange={(e) => updateVariant(index, 'hpp', e.target.value)}
                            placeholder="HPP"
                            className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-8 text-xs"
                          />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={variant.price}
                          onChange={(e) => updateVariant(index, 'price', e.target.value)}
                          placeholder="Price *"
                          className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Input
                          type="number"
                          min="0"
                          value={variant.stock}
                          onChange={(e) => updateVariant(index, 'stock', e.target.value)}
                          placeholder="Stock"
                          className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {variants.length === 0 && (
                <p className="text-[11px] text-zinc-500 text-center py-2">No variants added. Click &quot;Add Variant&quot; to start.</p>
              )}
            </div>
          )}

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
