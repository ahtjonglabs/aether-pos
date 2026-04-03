'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { formatCurrency, formatNumber, formatDate } from '@/lib/format'
import { usePlan } from '@/hooks/use-plan'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Pagination } from '@/components/shared/pagination'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  RefreshCw,
  Loader2,
  Eye,
  ArrowUpDown,
  Package,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Clock,
  User,
  ShoppingCart,
  ListChecks,
  Tag,
  X,
  AlertTriangle,
  PackageX,
  ChevronDown,
  ChevronRight,
  Tags,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { ProGate } from '@/components/shared/pro-gate'
import ProductFormDialog from './product-form-dialog'

interface Category {
  id: string
  name: string
  color: string
  _count?: { products: number }
}

interface Product {
  id: string
  name: string
  sku: string | null
  hpp: number
  price: number
  bruto: number
  netto: number
  stock: number
  lowStockAlert: number
  image: string | null
  categoryId: string | null
  category?: { id: string; name: string; color: string } | null
  unit: string
}

interface ProductListResponse {
  products: Product[]
  totalPages: number
}

type SortOption = 'newest' | 'best-selling' | 'low-stock' | 'most-stock'

interface MovementLog {
  id: string
  action: string
  details: Record<string, unknown>
  user: {
    id: string
    name: string | null
    email: string | null
    role: string
  }
  createdAt: string
}

interface MovementResponse {
  product: Product
  summary: {
    totalSold: number
    totalRestocked: number
    currentStock: number
    revenue: number
    lastRestockDate: string | null
  }
  movements: MovementLog[]
  totalPages: number
  totalLogs: number
}

type MovementFilterTab = 'all' | 'restock' | 'sale' | 'adjustment'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Terbaru' },
  { value: 'best-selling', label: 'Terlaris' },
  { value: 'low-stock', label: 'Stock Menipis' },
  { value: 'most-stock', label: 'Stock Terbanyak' },
]

const CATEGORY_COLORS = [
  'zinc', 'emerald', 'amber', 'rose', 'violet', 'sky',
  'cyan', 'orange', 'lime', 'teal', 'fuchsia', 'pink', 'indigo',
] as const

type CategoryColor = (typeof CATEGORY_COLORS)[number]

function getColorClasses(color: string) {
  const map: Record<string, { bg: string; text: string; border: string; dot: string; chipBg: string }> = {
    zinc: { bg: 'bg-zinc-500/10', text: 'text-zinc-300', border: 'border-zinc-500/20', dot: 'bg-zinc-400', chipBg: 'bg-zinc-500/5 border-zinc-500/20 hover:bg-zinc-500/10' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-400', chipBg: 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-400', chipBg: 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10' },
    rose: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', dot: 'bg-rose-400', chipBg: 'bg-rose-500/5 border-rose-500/20 hover:bg-rose-500/10' },
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20', dot: 'bg-violet-400', chipBg: 'bg-violet-500/5 border-violet-500/20 hover:bg-violet-500/10' },
    sky: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20', dot: 'bg-sky-400', chipBg: 'bg-sky-500/5 border-sky-500/20 hover:bg-sky-500/10' },
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20', dot: 'bg-cyan-400', chipBg: 'bg-cyan-500/5 border-cyan-500/20 hover:bg-cyan-500/10' },
    orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', dot: 'bg-orange-400', chipBg: 'bg-orange-500/5 border-orange-500/20 hover:bg-orange-500/10' },
    lime: { bg: 'bg-lime-500/10', text: 'text-lime-400', border: 'border-lime-500/20', dot: 'bg-lime-400', chipBg: 'bg-lime-500/5 border-lime-500/20 hover:bg-lime-500/10' },
    teal: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20', dot: 'bg-teal-400', chipBg: 'bg-teal-500/5 border-teal-500/20 hover:bg-teal-500/10' },
    fuchsia: { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-400', border: 'border-fuchsia-500/20', dot: 'bg-fuchsia-400', chipBg: 'bg-fuchsia-500/5 border-fuchsia-500/20 hover:bg-fuchsia-500/10' },
    pink: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20', dot: 'bg-pink-400', chipBg: 'bg-pink-500/5 border-pink-500/20 hover:bg-pink-500/10' },
    indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20', dot: 'bg-indigo-400', chipBg: 'bg-indigo-500/5 border-indigo-500/20 hover:bg-indigo-500/10' },
  }
  return map[color] || map['zinc']
}

function getColorDotClasses(color: string): string {
  const map: Record<string, string> = {
    zinc: 'bg-zinc-400', emerald: 'bg-emerald-400', amber: 'bg-amber-400', rose: 'bg-rose-400',
    violet: 'bg-violet-400', sky: 'bg-sky-400', cyan: 'bg-cyan-400', orange: 'bg-orange-400',
    lime: 'bg-lime-400', teal: 'bg-teal-400', fuchsia: 'bg-fuchsia-400', pink: 'bg-pink-400',
    indigo: 'bg-indigo-400',
  }
  return map[color] || 'bg-zinc-400'
}

function getActionBadge(action: string) {
  switch (action) {
    case 'CREATE':
      return <Badge className="bg-blue-500/10 border-blue-500/20 text-blue-400 text-[10px]">Create</Badge>
    case 'RESTOCK':
      return <Badge className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-[10px]">Restock</Badge>
    case 'SALE':
      return <Badge className="bg-amber-500/10 border-amber-500/20 text-amber-400 text-[10px]">Sale</Badge>
    case 'UPDATE':
      return <Badge className="bg-violet-500/10 border-violet-500/20 text-violet-400 text-[10px]">Update</Badge>
    case 'DELETE':
      return <Badge className="bg-red-500/10 border-red-500/20 text-red-400 text-[10px]">Delete</Badge>
    case 'ADJUSTMENT':
      return <Badge className="bg-orange-500/10 border-orange-500/20 text-orange-400 text-[10px]">Adjustment</Badge>
    case 'BULK_UPDATE':
      return <Badge className="bg-cyan-500/10 border-cyan-500/20 text-cyan-400 text-[10px]">Bulk Update</Badge>
    default:
      return <Badge className="bg-zinc-500/10 border-zinc-500/20 text-zinc-400 text-[10px]">{action}</Badge>
  }
}

function getActionDescription(action: string, details: Record<string, unknown>): string {
  switch (action) {
    case 'CREATE':
      return `Product created — Price: ${formatCurrency(Number(details.price) || 0)}, Stock: ${formatNumber(Number(details.stock) || 0)}`
    case 'RESTOCK':
      return `+${formatNumber(Number(details.quantityAdded) || 0)} units (Stock: ${formatNumber(Number(details.previousStock) || 0)} → ${formatNumber(Number(details.newStock) || 0)})`
    case 'SALE':
      return `Sold ${formatNumber(Number(details.qty) || 0)} units — ${formatCurrency(Number(details.subtotal) || 0)}`
    case 'UPDATE':
      return 'Product details updated'
    case 'DELETE':
      return 'Product deleted'
    case 'ADJUSTMENT':
      return `Stock adjusted — ${details.reason || 'No reason'}`
    case 'BULK_UPDATE':
      return 'Bulk update applied'
    default:
      return 'Action performed'
  }
}

function getActionRowBg(action: string): string {
  switch (action) {
    case 'RESTOCK':
      return 'bg-emerald-500/5 rounded'
    case 'SALE':
      return 'bg-amber-500/5 rounded'
    case 'ADJUSTMENT':
      return 'bg-orange-500/5 rounded'
    default:
      return ''
  }
}

export default function ProductsPage() {
  const { data: session } = useSession()
  const isOwner = session?.user?.role === 'OWNER'
  const { plan } = usePlan()
  const isPro = plan?.type === 'pro' || plan?.type === 'enterprise'

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('newest')
  const [formOpen, setFormOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [restockOpen, setRestockOpen] = useState(false)
  const [restockProduct, setRestockProduct] = useState<Product | null>(null)
  const [restockQty, setRestockQty] = useState('')
  const [restocking, setRestocking] = useState(false)

  // Detail sheet state
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailProduct, setDetailProduct] = useState<Product | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailData, setDetailData] = useState<MovementResponse | null>(null)
  const [detailPage, setDetailPage] = useState(1)
  const [movementFilter, setMovementFilter] = useState<MovementFilterTab>('all')

  // Bulk edit state
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false)
  const [bulkPriceType, setBulkPriceType] = useState<'percent' | 'fixed'>('percent')
  const [bulkPriceValue, setBulkPriceValue] = useState('')
  const [bulkPriceQuick, setBulkPriceQuick] = useState('')
  const [bulkPriceSubmitting, setBulkPriceSubmitting] = useState(false)

  const [bulkStockOpen, setBulkStockOpen] = useState(false)
  const [bulkStockType, setBulkStockType] = useState<'add' | 'subtract' | 'set'>('add')
  const [bulkStockValue, setBulkStockValue] = useState('')
  const [bulkStockSubmitting, setBulkStockSubmitting] = useState(false)

  // Bulk upload Excel state
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{
    created: number
    skipped: number
    errors: string[]
  } | null>(null)
  const [uploadDragOver, setUploadDragOver] = useState(false)

  // Category management state
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categorySectionOpen, setCategorySectionOpen] = useState(true)
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<Category | null>(null)
  const [categoryName, setCategoryName] = useState('')
  const [categoryColor, setCategoryColor] = useState<string>('zinc')
  const [categorySaving, setCategorySaving] = useState(false)
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null)
  const [deleteCategoryProductCount, setDeleteCategoryProductCount] = useState(0)
  const [categoryDeleting, setCategoryDeleting] = useState(false)

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(data.categories || [])
      }
    } catch {
      // silently fail
    } finally {
      setCategoriesLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      if (sort !== 'newest') params.set('sort', sort)
      if (activeCategoryId) params.set('categoryId', activeCategoryId)
      const res = await fetch(`/api/products?${params}`)
      if (res.ok) {
        const data: ProductListResponse = await res.json()
        setProducts(data.products)
        setTotalPages(data.totalPages)
      } else {
        toast.error('Failed to load products')
      }
    } catch {
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [page, search, sort, activeCategoryId])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, sort, activeCategoryId])

  const fetchDetail = useCallback(async (product: Product, pageNum: number) => {
    setDetailLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: '20' })
      const res = await fetch(`/api/products/${product.id}/movement?${params}`)
      if (res.ok) {
        const data: MovementResponse = await res.json()
        setDetailData(data)
      } else {
        toast.error('Failed to load product details')
      }
    } catch {
      toast.error('Failed to load product details')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const openDetail = (product: Product) => {
    setDetailProduct(product)
    setDetailPage(1)
    setDetailData(null)
    setMovementFilter('all')
    setDetailOpen(true)
  }

  useEffect(() => {
    if (detailOpen && detailProduct) {
      fetchDetail(detailProduct, detailPage)
    }
  }, [detailOpen, detailProduct, detailPage, fetchDetail])

  const handleEdit = (product: Product) => {
    setEditProduct(product)
    setFormOpen(true)
  }

  const handleAdd = () => {
    setEditProduct(null)
    setFormOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/products/${deleteId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Product deleted')
        fetchProducts()
      } else {
        toast.error('Failed to delete product')
      }
    } catch {
      toast.error('Failed to delete product')
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  const handleRestock = async () => {
    if (!restockProduct || !restockQty || Number(restockQty) <= 0) return
    setRestocking(true)
    try {
      const res = await fetch(`/api/products/${restockProduct.id}/restock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: Number(restockQty) }),
      })
      if (res.ok) {
        toast.success(`Restocked ${restockProduct.name} +${restockQty}`)
        fetchProducts()
        if (detailOpen && detailProduct?.id === restockProduct.id) {
          fetchDetail({ ...restockProduct, stock: restockProduct.stock + Number(restockQty) }, detailPage)
        }
      } else {
        toast.error('Failed to restock')
      }
    } catch {
      toast.error('Failed to restock')
    } finally {
      setRestocking(false)
      setRestockOpen(false)
      setRestockQty('')
      setRestockProduct(null)
    }
  }

  // Bulk edit handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)))
    }
  }

  const handleBulkPrice = async () => {
    if (selectedIds.size === 0 || !bulkPriceValue) return
    setBulkPriceSubmitting(true)
    try {
      const value = Number(bulkPriceValue)
      if (isNaN(value)) {
        toast.error('Invalid value')
        return
      }
      const res = await fetch('/api/products/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: Array.from(selectedIds),
          priceAdjustment: { type: bulkPriceType, value },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(`Updated ${data.updatedCount} product prices`)
        setBulkPriceOpen(false)
        setBulkPriceValue('')
        setBulkPriceQuick('')
        setSelectedIds(new Set())
        setBulkMode(false)
        fetchProducts()
      } else {
        toast.error('Failed to update prices')
      }
    } catch {
      toast.error('Failed to update prices')
    } finally {
      setBulkPriceSubmitting(false)
    }
  }

  const handleBulkStock = async () => {
    if (selectedIds.size === 0 || !bulkStockValue) return
    setBulkStockSubmitting(true)
    try {
      const value = Number(bulkStockValue)
      if (isNaN(value)) {
        toast.error('Invalid value')
        return
      }
      const res = await fetch('/api/products/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: Array.from(selectedIds),
          stockAdjustment: { type: bulkStockType, value },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(`Updated stock for ${data.updatedCount} products`)
        setBulkStockOpen(false)
        setBulkStockValue('')
        setSelectedIds(new Set())
        setBulkMode(false)
        fetchProducts()
      } else {
        toast.error('Failed to update stock')
      }
    } catch {
      toast.error('Failed to update stock')
    } finally {
      setBulkStockSubmitting(false)
    }
  }

  // Category CRUD handlers
  const openCategoryDialog = (cat: Category | null = null) => {
    setEditCategory(cat)
    setCategoryName(cat ? cat.name : '')
    setCategoryColor(cat ? cat.color : 'zinc')
    setCategoryDialogOpen(true)
  }

  const handleCategorySave = async () => {
    if (!categoryName.trim()) {
      toast.error('Nama kategori wajib diisi')
      return
    }
    setCategorySaving(true)
    try {
      const url = editCategory ? `/api/categories/${editCategory.id}` : '/api/categories'
      const method = editCategory ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: categoryName.trim(), color: categoryColor }),
      })
      if (res.ok) {
        toast.success(editCategory ? 'Kategori diperbarui' : 'Kategori ditambahkan')
        setCategoryDialogOpen(false)
        fetchCategories()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Gagal menyimpan kategori')
      }
    } catch {
      toast.error('Gagal menyimpan kategori')
    } finally {
      setCategorySaving(false)
    }
  }

  const handleCategoryDelete = async () => {
    if (!deleteCategoryId) return
    setCategoryDeleting(true)
    try {
      const res = await fetch(`/api/categories/${deleteCategoryId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Kategori dihapus')
        if (activeCategoryId === deleteCategoryId) {
          setActiveCategoryId(null)
        }
        fetchCategories()
        fetchProducts()
      } else {
        toast.error('Gagal menghapus kategori')
      }
    } catch {
      toast.error('Gagal menghapus kategori')
    } finally {
      setCategoryDeleting(false)
      setDeleteCategoryId(null)
    }
  }

  const openDeleteCategory = (cat: Category) => {
    setDeleteCategoryId(cat.id)
    setDeleteCategoryProductCount(cat._count?.products || 0)
  }

  // Filtered movements
  const filteredMovements = useMemo(() => {
    if (!detailData) return []
    return detailData.movements.filter((m) => {
      if (movementFilter === 'all') return true
      if (movementFilter === 'restock') return m.action === 'RESTOCK'
      if (movementFilter === 'sale') return m.action === 'SALE'
      if (movementFilter === 'adjustment') return m.action === 'ADJUSTMENT' || m.action === 'BULK_UPDATE'
      return true
    })
  }, [detailData, movementFilter])

  // Stock aging calculation
  const stockAgingDays = useMemo(() => {
    if (!detailData?.summary.lastRestockDate) return null
    const lastDate = new Date(detailData.summary.lastRestockDate)
    const now = new Date()
    const diff = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }, [detailData])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Products</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Manage your product inventory</p>
        </div>
        <div className="flex items-center gap-2">
          {isPro && isOwner && (
            <Button
              variant={bulkMode ? 'default' : 'outline'}
              onClick={() => {
                setBulkMode(!bulkMode)
                setSelectedIds(new Set())
              }}
              className={
                bulkMode
                  ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500 h-8 text-xs'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 h-8 text-xs'
              }
            >
              <ListChecks className="mr-1.5 h-3.5 w-3.5" />
              {bulkMode ? 'Edit Massal Aktif' : 'Edit Massal'}
            </Button>
          )}
          <ProGate feature="bulkUpload" label="Upload Excel" description="Upload produk massal via file Excel" minHeight="40px">
            <Button
              variant="outline"
              onClick={() => {
                setUploadOpen(true)
                setUploadFile(null)
                setUploadResult(null)
              }}
              className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 h-8 text-xs"
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Upload Excel
            </Button>
          </ProGate>
          <Button onClick={handleAdd} className="bg-emerald-500 hover:bg-emerald-600 text-white h-8 text-xs">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Category Management Section */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
        <button
          onClick={() => setCategorySectionOpen(!categorySectionOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-zinc-800/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Tags className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-zinc-200">Kategori</span>
            {!categoriesLoading && categories.length > 0 && (
              <span className="text-[11px] text-zinc-500">({categories.length})</span>
            )}
            {activeCategoryId && (
              <Badge className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0 ml-1">
                Filter aktif
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveCategoryId(null) }}
                  className="ml-1 hover:text-emerald-300"
                >
                  <X className="h-2.5 w-2.5 inline" />
                </button>
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={(e) => { e.stopPropagation(); openCategoryDialog(null) }}
              className="bg-emerald-500 hover:bg-emerald-600 text-white h-6 text-[11px] px-2"
            >
              <Plus className="mr-1 h-3 w-3" />
              Tambah
            </Button>
            {categorySectionOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
            )}
          </div>
        </button>

        {categorySectionOpen && (
          <div className="px-4 pb-3">
            {categoriesLoading ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-28 bg-zinc-800 rounded-full flex-shrink-0" />
                ))}
              </div>
            ) : categories.length === 0 ? (
              <p className="text-[11px] text-zinc-500 py-2">Belum ada kategori. Klik "Tambah" untuk membuat kategori baru.</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {categories.map((cat) => {
                  const colors = getColorClasses(cat.color)
                  const isActive = activeCategoryId === cat.id
                  return (
                    <div
                      key={cat.id}
                      className={`group flex items-center gap-1.5 rounded-full border px-2.5 py-1 flex-shrink-0 cursor-pointer transition-all ${
                        isActive
                          ? `${colors.chipBg} ${colors.text} ring-1 ${colors.border}`
                          : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 hover:border-zinc-600'
                      }`}
                      onClick={() => setActiveCategoryId(isActive ? null : cat.id)}
                    >
                      <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${getColorDotClasses(cat.color)}`} />
                      <span className="text-[11px] font-medium whitespace-nowrap">{cat.name}</span>
                      <span className="text-[10px] opacity-60">{cat._count?.products || 0}</span>
                      <div className="flex items-center gap-0 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); openCategoryDialog(cat) }}
                          className="hover:text-emerald-400 text-zinc-500 hover:bg-zinc-700 rounded p-0.5"
                          title="Edit"
                        >
                          <Edit className="h-2.5 w-2.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openDeleteCategory(cat) }}
                          className="hover:text-red-400 text-zinc-500 hover:bg-zinc-700 rounded p-0.5"
                          title="Hapus"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search & Sort */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
          />
        </div>
        <Select value={sort} onValueChange={(val) => setSort(val as SortOption)}>
          <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs bg-zinc-800 border-zinc-700 text-zinc-100">
            <ArrowUpDown className="mr-2 h-3.5 w-3.5 text-zinc-500" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700">
            {SORT_OPTIONS.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100"
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 bg-zinc-900 rounded" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
          <p className="text-xs text-zinc-500">No products found</p>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-800 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                {bulkMode && (
                  <TableHead className="text-zinc-500 text-[11px] font-medium w-10">
                    <Checkbox
                      checked={selectedIds.size === products.length && products.length > 0}
                      onCheckedChange={toggleSelectAll}
                      className="border-zinc-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                    />
                  </TableHead>
                )}
                <TableHead className="text-zinc-500 text-[11px] font-medium">Name</TableHead>
                <TableHead className="text-zinc-500 text-[11px] font-medium">Kategori</TableHead>
                <TableHead className="text-zinc-500 text-[11px] font-medium">SKU</TableHead>
                <TableHead className="text-zinc-500 text-[11px] font-medium">Satuan</TableHead>
                {isOwner && (
                  <TableHead className="text-zinc-500 text-[11px] font-medium text-right">HPP</TableHead>
                )}
                <TableHead className="text-zinc-500 text-[11px] font-medium text-right">Price</TableHead>
                <TableHead className="text-zinc-500 text-[11px] font-medium text-right">Stock</TableHead>
                <TableHead className="text-zinc-500 text-[11px] font-medium text-right w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const isOutOfStock = product.stock === 0
                const isLowStock = product.stock > 0 && product.stock <= product.lowStockAlert
                const isSelected = selectedIds.has(product.id)

                let rowClass = 'border-zinc-800 hover:bg-zinc-800/50'
                if (isPro) {
                  if (isOutOfStock) {
                    rowClass = 'border-zinc-800 bg-red-500/5 hover:bg-red-500/10'
                  } else if (isLowStock) {
                    rowClass = 'border-zinc-800 bg-amber-500/5 hover:bg-amber-500/10'
                  }
                }

                return (
                  <TableRow key={product.id} className={rowClass}>
                    {bulkMode && (
                      <TableCell className="w-10 py-2.5 px-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(product.id)}
                          className="border-zinc-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                        />
                      </TableCell>
                    )}
                    <TableCell className="text-xs text-zinc-200 font-medium py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        {isPro && isOutOfStock && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                          </span>
                        )}
                        {isPro && isLowStock && !isOutOfStock && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                          </span>
                        )}
                        {product.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs py-2.5 px-3">
                      {product.category ? (
                        <div className="flex items-center gap-1.5">
                          <div className={`h-2 w-2 rounded-full flex-shrink-0 ${getColorDotClasses(product.category.color)}`} />
                          <span className={`text-[11px] font-medium ${getColorClasses(product.category.color).text}`}>
                            {product.category.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-zinc-600">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-400 py-2.5 px-3">{product.sku || '-'}</TableCell>
                    <TableCell className="text-xs py-2.5 px-3">
                      <Badge className="bg-sky-500/10 border-sky-500/20 text-sky-400 text-[10px] px-1.5 py-0">
                        {product.unit || 'pcs'}
                      </Badge>
                    </TableCell>
                    {isOwner && (
                      <TableCell className="text-xs text-zinc-300 text-right py-2.5 px-3">{formatCurrency(product.hpp)}</TableCell>
                    )}
                    <TableCell className="text-xs text-zinc-200 text-right py-2.5 px-3">{formatCurrency(product.price)}</TableCell>
                    <TableCell className="text-xs text-right py-2.5 px-3">
                      {isPro ? (
                        <div className="flex items-center justify-end gap-1.5">
                          {isOutOfStock ? (
                            <Badge className="bg-red-500/10 border-red-500/20 text-red-400 text-[10px] px-1.5 py-0">
                              <PackageX className="mr-0.5 h-2.5 w-2.5" />
                              HABIS
                            </Badge>
                          ) : isLowStock ? (
                            <Badge className="bg-amber-500/10 border-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0">
                              {formatNumber(product.stock)}
                            </Badge>
                          ) : (
                            <span className="text-zinc-200">{formatNumber(product.stock)}</span>
                          )}
                        </div>
                      ) : product.stock <= product.lowStockAlert ? (
                        <Badge className="bg-red-500/10 border-red-500/20 text-red-400 text-[10px] px-1.5 py-0">
                          {formatNumber(product.stock)}
                        </Badge>
                      ) : (
                        <span className="text-zinc-200">{formatNumber(product.stock)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right py-2.5 px-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-zinc-400 hover:text-sky-400 hover:bg-sky-500/10"
                          onClick={() => openDetail(product)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() => {
                            setRestockProduct(product)
                            setRestockQty('')
                            setRestockOpen(true)
                          }}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                          onClick={() => handleEdit(product)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                          onClick={() => setDeleteId(product.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Floating Bulk Edit Bar */}
      {bulkMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-700 bg-zinc-900/95 backdrop-blur-sm p-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-zinc-300">
                  <span className="font-semibold text-emerald-400">{selectedIds.size}</span> dipilih
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
                className="text-zinc-500 hover:text-zinc-300 h-7 text-[11px] px-2"
              >
                <X className="mr-1 h-3 w-3" />
                Batal
              </Button>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                onClick={() => setBulkPriceOpen(true)}
                className="bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 h-7 text-xs"
              >
                <Tag className="mr-1.5 h-3 w-3" />
                Ubah Harga
              </Button>
              <Button
                size="sm"
                onClick={() => setBulkStockOpen(true)}
                className="bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 h-7 text-xs"
              >
                <Package className="mr-1.5 h-3 w-3" />
                Ubah Stok
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Product Form Dialog */}
      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editProduct}
        onSaved={() => { fetchProducts(); fetchCategories() }}
      />

      {/* Category Create/Edit Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 text-sm font-semibold">
              {editCategory ? 'Edit Kategori' : 'Tambah Kategori'}
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              {editCategory ? 'Ubah nama dan warna kategori' : 'Buat kategori baru untuk mengelompokkan produk'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-xs">Nama Kategori *</Label>
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Contoh: Minuman, Makanan, Snack"
                className="h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                onKeyDown={(e) => { if (e.key === 'Enter') handleCategorySave() }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-xs">Warna</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {CATEGORY_COLORS.map((color) => {
                  const isSelected = categoryColor === color
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setCategoryColor(color)}
                      className={`h-7 w-7 rounded-full ${getColorDotClasses(color)} transition-all ${
                        isSelected ? 'ring-2 ring-offset-2 ring-offset-zinc-900 ring-white/50 scale-110' : 'hover:scale-105 opacity-70 hover:opacity-100'
                      }`}
                      title={color}
                    />
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setCategoryDialogOpen(false)}
              className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 h-8 text-xs"
            >
              Batal
            </Button>
            <Button
              onClick={handleCategorySave}
              disabled={categorySaving || !categoryName.trim()}
              className="bg-emerald-500 hover:bg-emerald-600 text-white h-8 text-xs"
            >
              {categorySaving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              {editCategory ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Delete Confirmation */}
      <AlertDialog open={!!deleteCategoryId} onOpenChange={(open) => !open && setDeleteCategoryId(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100 text-sm font-semibold">Hapus Kategori</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 text-xs">
              {deleteCategoryProductCount > 0 ? (
                <>
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Perhatian!
                  </span>
                  <br />
                  Kategori ini memiliki <span className="text-zinc-200 font-medium">{deleteCategoryProductCount} produk</span>. Produk akan dikembalikan ke status tanpa kategori.
                </>
              ) : (
                'Apakah Anda yakin ingin menghapus kategori ini? Tindakan ini tidak dapat dibatalkan.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 h-8 text-xs">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCategoryDelete}
              disabled={categoryDeleting}
              className="bg-red-500 hover:bg-red-600 text-white h-8 text-xs"
            >
              {categoryDeleting && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100 text-sm font-semibold">Delete Product</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 text-xs">
              Are you sure? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 h-8 text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600 text-white h-8 text-xs"
            >
              {deleting && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restock Dialog */}
      <Dialog open={restockOpen} onOpenChange={setRestockOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 text-sm font-semibold">
              Restock: {restockProduct?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="text-xs text-zinc-400">
              Current stock: <span className="text-zinc-200 font-medium">{restockProduct?.stock}</span>
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-xs">Quantity to add</Label>
              <Input
                type="number"
                min="1"
                placeholder="Enter quantity"
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
                className="h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRestockOpen(false)}
              className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRestock}
              disabled={restocking || !restockQty || Number(restockQty) <= 0}
              className="bg-emerald-500 hover:bg-emerald-600 text-white h-8 text-xs"
            >
              {restocking && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Restock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Price Dialog */}
      <Dialog open={bulkPriceOpen} onOpenChange={setBulkPriceOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 text-sm font-semibold">Ubah Harga Massal</DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Mengubah harga untuk {selectedIds.size} produk
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant={bulkPriceType === 'percent' ? 'default' : 'outline'}
                onClick={() => setBulkPriceType('percent')}
                className={
                  bulkPriceType === 'percent'
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500 h-7 text-xs'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-zinc-100 h-7 text-xs'
                }
              >
                Persen (%)
              </Button>
              <Button
                size="sm"
                variant={bulkPriceType === 'fixed' ? 'default' : 'outline'}
                onClick={() => setBulkPriceType('fixed')}
                className={
                  bulkPriceType === 'fixed'
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500 h-7 text-xs'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-zinc-100 h-7 text-xs'
                }
              >
                Nominal (Rp)
              </Button>
            </div>

            {/* Quick adjust buttons */}
            {bulkPriceType === 'percent' && (
              <div className="flex flex-wrap gap-1.5">
                {['+10', '+20', '+5', '-5', '-10', '-20'].map((q) => (
                  <Button
                    key={q}
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setBulkPriceQuick(q)
                      setBulkPriceValue(q)
                    }}
                    className={
                      bulkPriceQuick === q
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 h-7 text-xs'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 h-7 text-xs'
                    }
                  >
                    {q}%
                  </Button>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-xs">
                {bulkPriceType === 'percent' ? 'Persentase (contoh: 10 atau -10)' : 'Jumlah nominal (contoh: 5000 atau -5000)'}
              </Label>
              <Input
                type="number"
                placeholder={bulkPriceType === 'percent' ? '10' : '5000'}
                value={bulkPriceValue}
                onChange={(e) => {
                  setBulkPriceValue(e.target.value)
                  setBulkPriceQuick('')
                }}
                className="h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setBulkPriceOpen(false)}
              className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 h-8 text-xs"
            >
              Batal
            </Button>
            <Button
              onClick={handleBulkPrice}
              disabled={bulkPriceSubmitting || !bulkPriceValue}
              className="bg-emerald-500 hover:bg-emerald-600 text-white h-8 text-xs"
            >
              {bulkPriceSubmitting && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Terapkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Stock Dialog */}
      <Dialog open={bulkStockOpen} onOpenChange={setBulkStockOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 text-sm font-semibold">Ubah Stok Massal</DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Mengubah stok untuk {selectedIds.size} produk
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant={bulkStockType === 'add' ? 'default' : 'outline'}
                onClick={() => setBulkStockType('add')}
                className={
                  bulkStockType === 'add'
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500 h-7 text-xs'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-zinc-100 h-7 text-xs'
                }
              >
                Tambah
              </Button>
              <Button
                size="sm"
                variant={bulkStockType === 'subtract' ? 'default' : 'outline'}
                onClick={() => setBulkStockType('subtract')}
                className={
                  bulkStockType === 'subtract'
                    ? 'bg-red-500 hover:bg-red-600 text-white border-red-500 h-7 text-xs'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-zinc-100 h-7 text-xs'
                }
              >
                Kurangi
              </Button>
              <Button
                size="sm"
                variant={bulkStockType === 'set' ? 'default' : 'outline'}
                onClick={() => setBulkStockType('set')}
                className={
                  bulkStockType === 'set'
                    ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500 h-7 text-xs'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-zinc-100 h-7 text-xs'
                }
              >
                Set
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-xs">
                {bulkStockType === 'set' ? 'Jumlah stok baru' : `Jumlah yang akan ditambah/dikurangi`}
              </Label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={bulkStockValue}
                onChange={(e) => setBulkStockValue(e.target.value)}
                className="h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setBulkStockOpen(false)}
              className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 h-8 text-xs"
            >
              Batal
            </Button>
            <Button
              onClick={handleBulkStock}
              disabled={bulkStockSubmitting || !bulkStockValue || Number(bulkStockValue) < 0}
              className="bg-emerald-500 hover:bg-emerald-600 text-white h-8 text-xs"
            >
              {bulkStockSubmitting && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Terapkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Excel Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 text-sm font-semibold">Upload Produk Excel</DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Upload file Excel (.xlsx) untuk menambahkan produk secara massal (maks. 500 baris)
            </DialogDescription>
          </DialogHeader>

          {!uploadResult ? (
            <div className="space-y-3 py-1">
              {/* Download template */}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  window.open('/api/products/bulk-upload/template', '_blank')
                }}
                className="w-full bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 h-9 text-xs"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Download Template Excel
              </Button>

              {/* Drag and drop area */}
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setUploadDragOver(true)
                }}
                onDragLeave={() => setUploadDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setUploadDragOver(false)
                  const file = e.dataTransfer.files[0]
                  if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
                    setUploadFile(file)
                  } else {
                    toast.error('Format file tidak didukung. Gunakan .xlsx atau .xls')
                  }
                }}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  uploadDragOver
                    ? 'border-emerald-500 bg-emerald-500/5'
                    : uploadFile
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-zinc-700 hover:border-zinc-600'
                }`}
              >
                {uploadFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                    <span className="text-xs text-zinc-200">{uploadFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setUploadFile(null)}
                      className="h-6 w-6 p-0 text-zinc-500 hover:text-red-400"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto mb-2 text-zinc-600" />
                    <p className="text-xs text-zinc-400">Drag & drop file Excel di sini</p>
                    <p className="text-[11px] text-zinc-500 mt-1">atau</p>
                  </>
                )}
              </div>

              {!uploadFile && (
                <label className="block">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) setUploadFile(file)
                    }}
                    className="hidden"
                  />
                  <div className="w-full text-center py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 cursor-pointer text-xs">
                    Pilih File
                  </div>
                </label>
              )}

              <div className="space-y-1">
                <p className="text-[11px] text-zinc-500 font-medium">Kolom yang dibutuhkan:</p>
                <p className="text-[11px] text-zinc-400">Nama* (wajib), Harga Jual* (wajib), SKU, HPP, Stok, Satuan, Kategori</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-1">
              {/* Result summary */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-2">
                <h3 className="text-xs font-semibold text-zinc-300">Hasil Upload</h3>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-zinc-300">
                      <span className="font-semibold text-emerald-400">{uploadResult.created}</span> produk berhasil ditambahkan
                    </span>
                  </div>
                  {uploadResult.skipped > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                      <span className="text-zinc-300">
                        <span className="font-semibold text-amber-400">{uploadResult.skipped}</span> produk dilewati (sudah ada)
                      </span>
                    </div>
                  )}
                  {uploadResult.errors.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                        <span className="text-red-400 font-medium">{uploadResult.errors.length} error</span>
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-0.5">
                        {uploadResult.errors.map((err, i) => (
                          <p key={i} className="text-[11px] text-zinc-500 pl-5">• {err}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {!uploadResult ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setUploadOpen(false)}
                  className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 h-8 text-xs"
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    if (!uploadFile) return
                    setUploading(true)
                    try {
                      const formData = new FormData()
                      formData.append('file', uploadFile)
                      const res = await fetch('/api/products/bulk-upload', {
                        method: 'POST',
                        body: formData,
                      })
                      if (res.ok) {
                        const data = await res.json()
                        setUploadResult(data)
                        fetchProducts()
                        toast.success(`${data.created} produk berhasil ditambahkan`)
                      } else {
                        const data = await res.json()
                        toast.error(data.error || 'Gagal upload file')
                      }
                    } catch {
                      toast.error('Gagal upload file')
                    } finally {
                      setUploading(false)
                    }
                  }}
                  disabled={uploading || !uploadFile}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white h-8 text-xs"
                >
                  {uploading && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                  Upload
                </Button>
              </>
            ) : (
              <Button
                type="button"
                onClick={() => setUploadOpen(false)}
                className="bg-emerald-500 hover:bg-emerald-600 text-white h-8 text-xs"
              >
                Selesai
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg bg-zinc-900 border-zinc-800 p-0 overflow-hidden"
        >
          {detailProduct && (
            <>
              <SheetHeader className="p-4 pb-3">
                <SheetTitle className="text-zinc-100 text-sm font-semibold">
                  {detailProduct.name}
                </SheetTitle>
                <SheetDescription className="text-zinc-500 text-[11px]">
                  {detailProduct.sku || 'No SKU'} • {formatCurrency(detailProduct.price)}
                </SheetDescription>
              </SheetHeader>

              <ScrollArea className="h-[calc(100vh-64px)]">
                <div className="px-4 pb-4 space-y-4">
                  {detailLoading && !detailData ? (
                    <div className="space-y-3">
                      <Skeleton className="h-16 bg-zinc-800 rounded" />
                      <Skeleton className="h-48 bg-zinc-800 rounded" />
                    </div>
                  ) : detailData ? (
                    <>
                      {/* Product Info Card */}
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-2">
                        <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5 text-emerald-400" />
                          Product Info
                        </h3>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-zinc-500 text-[11px]">SKU</span>
                            <p className="text-zinc-200">{detailData.product.sku || '-'}</p>
                          </div>
                          <div>
                            <span className="text-zinc-500 text-[11px]">Stock</span>
                            <p className={
                              detailData.product.stock <= detailData.product.lowStockAlert
                                ? 'text-red-400'
                                : 'text-zinc-200'
                            }>
                              {formatNumber(detailData.product.stock)}
                            </p>
                          </div>
                          {isOwner && (
                            <div>
                              <span className="text-zinc-500 text-[11px]">HPP</span>
                              <p className="text-zinc-200">{formatCurrency(detailData.product.hpp)}</p>
                            </div>
                          )}
                          <div>
                            <span className="text-zinc-500 text-[11px]">Price</span>
                            <p className="text-zinc-200">{formatCurrency(detailData.product.price)}</p>
                          </div>
                          {detailData.product.bruto > 0 && (
                            <div>
                              <span className="text-zinc-500 text-[11px]">Bruto</span>
                              <p className="text-zinc-200">{formatNumber(detailData.product.bruto)}g</p>
                            </div>
                          )}
                          {detailData.product.netto > 0 && (
                            <div>
                              <span className="text-zinc-500 text-[11px]">Netto</span>
                              <p className="text-zinc-200">{formatNumber(detailData.product.netto)}g</p>
                            </div>
                          )}
                          <div>
                            <span className="text-zinc-500 text-[11px]">Low Stock Alert</span>
                            <p className="text-zinc-200">{formatNumber(detailData.product.lowStockAlert)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Stock Aging (Pro feature) */}
                      {isPro && (
                        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-2">
                          <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-amber-400" />
                            Stock Aging
                          </h3>
                          {stockAgingDays === null ? (
                            <p className="text-xs text-zinc-500">Belum ada data restock</p>
                          ) : (
                            <div className="space-y-1.5">
                              <p className="text-xs text-zinc-300">
                                Terakhir restok: <span className="font-semibold text-zinc-100">{stockAgingDays} hari yang lalu</span>
                              </p>
                              {stockAgingDays > 60 ? (
                                <div className="flex items-center gap-1.5 p-2 rounded bg-red-500/10 border border-red-500/20">
                                  <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                                  <span className="text-xs text-red-400 font-medium">Segera cuci gudang</span>
                                </div>
                              ) : stockAgingDays > 30 ? (
                                <div className="flex items-center gap-1.5 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                  <span className="text-xs text-amber-400 font-medium">Perlu evaluasi stok</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                                  <Package className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                  <span className="text-xs text-emerald-400 font-medium">Stok masih segar</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Summary Stats Card */}
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-2">
                        <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                          <BarChart3 className="h-3.5 w-3.5 text-emerald-400" />
                          Summary
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded bg-zinc-800/50 p-2.5">
                            <div className="flex items-center gap-1.5 text-zinc-500 mb-0.5">
                              <ShoppingCart className="h-3 w-3" />
                              <span className="text-[11px]">Total Terjual</span>
                            </div>
                            <p className="text-sm font-semibold text-zinc-100">
                              {formatNumber(detailData.summary.totalSold)}
                            </p>
                          </div>
                          <div className="rounded bg-zinc-800/50 p-2.5">
                            <div className="flex items-center gap-1.5 text-zinc-500 mb-0.5">
                              <TrendingUp className="h-3 w-3" />
                              <span className="text-[11px]">Total Restock</span>
                            </div>
                            <p className="text-sm font-semibold text-emerald-400">
                              +{formatNumber(detailData.summary.totalRestocked)}
                            </p>
                          </div>
                          <div className="rounded bg-zinc-800/50 p-2.5">
                            <div className="flex items-center gap-1.5 text-zinc-500 mb-0.5">
                              <Package className="h-3 w-3" />
                              <span className="text-[11px]">Stock Saat Ini</span>
                            </div>
                            <p className="text-sm font-semibold text-zinc-100">
                              {formatNumber(detailData.summary.currentStock)}
                            </p>
                          </div>
                          <div className="rounded bg-zinc-800/50 p-2.5">
                            <div className="flex items-center gap-1.5 text-zinc-500 mb-0.5">
                              <DollarSign className="h-3 w-3" />
                              <span className="text-[11px]">Revenue</span>
                            </div>
                            <p className="text-sm font-semibold text-amber-400">
                              {formatCurrency(detailData.summary.revenue)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Movement History with Filter Tabs */}
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-2">
                        <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-emerald-400" />
                          Movement History
                        </h3>

                        <Tabs value={movementFilter} onValueChange={(v) => setMovementFilter(v as MovementFilterTab)}>
                          <TabsList className="bg-zinc-800 border-zinc-700 h-7">
                            <TabsTrigger value="all" className="text-[11px] h-5 px-2.5 data-[state=active]:bg-zinc-700 data-[state=active]:text-zinc-100 text-zinc-400">
                              Semua
                            </TabsTrigger>
                            <TabsTrigger value="restock" className="text-[11px] h-5 px-2.5 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 text-zinc-400">
                              Restock
                            </TabsTrigger>
                            <TabsTrigger value="sale" className="text-[11px] h-5 px-2.5 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 text-zinc-400">
                              Penjualan
                            </TabsTrigger>
                            <TabsTrigger value="adjustment" className="text-[11px] h-5 px-2.5 data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 text-zinc-400">
                              Penyesuaian
                            </TabsTrigger>
                          </TabsList>
                        </Tabs>

                        {filteredMovements.length === 0 ? (
                          <div className="py-6 text-center text-zinc-500 text-xs">
                            No movement history for this filter
                          </div>
                        ) : (
                          <div className="space-y-0">
                            {filteredMovements.map((log, idx) => (
                              <div key={log.id}>
                                {idx > 0 && <Separator className="bg-zinc-800 my-1.5" />}
                                <div className={`flex items-start gap-2 py-2 px-2 ${getActionRowBg(log.action)}`}>
                                  <div className="flex-shrink-0 pt-0.5">
                                    {getActionBadge(log.action)}
                                  </div>
                                  <div className="flex-1 min-w-0 space-y-0.5">
                                    <p className="text-xs text-zinc-200">
                                      {getActionDescription(log.action, log.details)}
                                    </p>
                                    <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                                      <span className="flex items-center gap-1">
                                        <User className="h-2.5 w-2.5" />
                                        {log.user?.name || log.user?.email || 'System'}
                                      </span>
                                      <span>{formatDate(log.createdAt)}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {detailData.totalPages > 1 && (
                          <div className="pt-2 border-t border-zinc-800">
                            <Pagination
                              currentPage={detailPage}
                              totalPages={detailData.totalPages}
                              onPageChange={setDetailPage}
                            />
                          </div>
                        )}
                      </div>
                    </>
                  ) : null}
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
