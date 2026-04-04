'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogDescription, ResponsiveDialogFooter } from '@/components/ui/responsive-dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Package,
  Banknote,
  QrCode,
  Loader2,
  Check,
  X,
  User,
  UserPlus,
  Coins,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Wifi,
  WifiOff,
  RefreshCw,
  CloudOff,
  Database,
  ArrowDownToLine,
  LayoutGrid,
  ReceiptText,
  AlertCircle,
  Store,
  Tag,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useLiveQuery } from 'dexie-react-hooks'
import { localDB, type CachedProduct, type CachedCategory, type CachedCustomer } from '@/lib/local-db'
import { syncAllData, getAllSyncTimes, syncSettingsFromServer, getCachedSettings } from '@/lib/sync-service'
import { cn } from '@/lib/utils'
import { useSession } from 'next-auth/react'
import { usePageStore } from '@/hooks/use-page-store'

// ==================== TYPES ====================

interface Product {
  id: string
  name: string
  price: number
  stock: number
  sku: string | null
  barcode: string | null
  categoryId: string | null
  image: string | null
}

interface Category {
  id: string
  name: string
  color: string
}

interface Customer {
  id: string
  name: string
  whatsapp: string
  points: number
}

interface CartItem {
  product: Product
  qty: number
}

interface CheckoutResult {
  success: boolean
  invoiceNumber: string
  message?: string
  syncError?: string
}

interface OutletSettings {
  paymentMethods: string
  loyaltyEnabled: boolean
  loyaltyPointsPerAmount: number
  loyaltyPointValue: number
  receiptBusinessName: string
  receiptAddress: string
  receiptPhone: string
  receiptFooter: string
  receiptLogo: string
  themePrimaryColor: string
}

interface OutletInfo {
  id: string
  name: string
  address: string | null
  phone: string | null
}

interface UserOutlet {
  id: string
  name: string
  address: string | null
  phone: string | null
  isPrimary: boolean
}

const PRODUCTS_PER_PAGE = 24

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; activeBg: string }> = {
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', activeBg: 'bg-emerald-500/20' },
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', activeBg: 'bg-blue-500/20' },
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20', activeBg: 'bg-violet-500/20' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', activeBg: 'bg-rose-500/20' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', activeBg: 'bg-amber-500/20' },
  cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20', activeBg: 'bg-cyan-500/20' },
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', activeBg: 'bg-orange-500/20' },
  pink: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20', activeBg: 'bg-pink-500/20' },
  teal: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20', activeBg: 'bg-teal-500/20' },
  zinc: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/20', activeBg: 'bg-zinc-500/20' },
}

const QUICK_NOMINALS = [5000, 10000, 20000, 50000, 100000, 200000, 500000]

// ==================== MAIN COMPONENT ====================

export default function PosPage() {
  const { data: session } = useSession()
  const isMobile = useIsMobile()
  const { currentPage } = usePageStore()

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncingRef = useRef(false)
  const receiptContentRef = useRef<HTMLDivElement>(null)
  const initialSyncDone = useRef(false)

  // Offline / Online state (MUST be declared before useEffects that depend on it)
  const [isOnline, setIsOnline] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [dataSyncing, setDataSyncing] = useState(false)
  const [lastSyncTimes, setLastSyncTimes] = useState<{ products: number | null; categories: number | null; customers: number | null; promos: number | null }>({ products: null, categories: null, customers: null, promos: null })

  // Products & Categories
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [productsLoading, setProductsLoading] = useState(true)
  const [productPage, setProductPage] = useState(1)
  const [totalProductPages, setTotalProductPages] = useState(1)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  // Settings (full outlet settings)
  const [settings, setSettings] = useState<OutletSettings>({
    paymentMethods: 'CASH,QRIS',
    loyaltyEnabled: true,
    loyaltyPointsPerAmount: 10000,
    loyaltyPointValue: 100,
    receiptBusinessName: 'Aether POS',
    receiptAddress: '',
    receiptPhone: '',
    receiptFooter: 'Terima kasih atas kunjungan Anda!',
    receiptLogo: '',
    themePrimaryColor: 'emerald',
  })

  // Outlet info (from settings API)
  const [outletInfo, setOutletInfo] = useState<OutletInfo | null>(null)
  const [userOutlets, setUserOutlets] = useState<UserOutlet[]>([])
  const [outletsLoading, setOutletsLoading] = useState(false)

  const availablePaymentMethods = useMemo(() => {
    return settings.paymentMethods.split(',').map(m => m.trim().toUpperCase()).filter(Boolean) as Array<'CASH' | 'QRIS' | 'DEBIT'>
  }, [settings.paymentMethods])

  // Fetch settings (online: from API + cache to IndexedDB, offline: from IndexedDB cache)
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        if (isOnline) {
          const res = await fetch('/api/settings')
          if (res.ok) {
            const data = await res.json()
            setSettings({
              paymentMethods: data.paymentMethods || 'CASH,QRIS',
              loyaltyEnabled: data.loyaltyEnabled ?? true,
              loyaltyPointsPerAmount: data.loyaltyPointsPerAmount || 10000,
              loyaltyPointValue: data.loyaltyPointValue || 100,
              receiptBusinessName: data.receiptBusinessName || 'Aether POS',
              receiptAddress: data.receiptAddress || '',
              receiptPhone: data.receiptPhone || '',
              receiptFooter: data.receiptFooter || 'Terima kasih atas kunjungan Anda!',
              receiptLogo: data.receiptLogo || '',
              themePrimaryColor: data.themePrimaryColor || 'emerald',
            })
            // Extract outlet info from settings response
            if (data.outlet) {
              setOutletInfo({
                id: data.outlet.id,
                name: data.outlet.name,
                address: data.outlet.address,
                phone: data.outlet.phone,
              })
            }
            // Cache settings for offline use
            syncSettingsFromServer()
          }
        } else {
          // Offline: load from IndexedDB cache
          const cached = await getCachedSettings()
          if (cached) {
            setSettings({
              paymentMethods: (cached.paymentMethods as string) || 'CASH,QRIS',
              loyaltyEnabled: (cached.loyaltyEnabled as boolean) ?? true,
              loyaltyPointsPerAmount: (cached.loyaltyPointsPerAmount as number) || 10000,
              loyaltyPointValue: (cached.loyaltyPointValue as number) || 100,
              receiptBusinessName: (cached.receiptBusinessName as string) || 'Aether POS',
              receiptAddress: (cached.receiptAddress as string) || '',
              receiptPhone: (cached.receiptPhone as string) || '',
              receiptFooter: (cached.receiptFooter as string) || 'Terima kasih atas kunjungan Anda!',
              receiptLogo: (cached.receiptLogo as string) || '',
              themePrimaryColor: (cached.themePrimaryColor as string) || 'emerald',
            })
            // Extract outlet info from cached settings
            const cachedOutlet = cached.outlet as { id: string; name: string; address: string | null; phone: string | null } | undefined
            if (cachedOutlet) {
              setOutletInfo({
                id: cachedOutlet.id,
                name: cachedOutlet.name,
                address: cachedOutlet.address,
                phone: cachedOutlet.phone,
              })
            }
          }
        }
      } catch { /* use defaults */ }
    }
    fetchSettings()
  }, [isOnline])

  // Re-fetch settings when returning to POS page
  useEffect(() => {
    if (currentPage === 'pos') {
      const refetchSettings = async () => {
        try {
          if (isOnline) {
            const res = await fetch('/api/settings')
            if (res.ok) {
              const data = await res.json()
              setSettings({
                paymentMethods: data.paymentMethods || 'CASH,QRIS',
                loyaltyEnabled: data.loyaltyEnabled ?? true,
                loyaltyPointsPerAmount: data.loyaltyPointsPerAmount || 10000,
                loyaltyPointValue: data.loyaltyPointValue || 100,
                receiptBusinessName: data.receiptBusinessName || 'Aether POS',
                receiptAddress: data.receiptAddress || '',
                receiptPhone: data.receiptPhone || '',
                receiptFooter: data.receiptFooter || 'Terima kasih atas kunjungan Anda!',
                receiptLogo: data.receiptLogo || '',
                themePrimaryColor: data.themePrimaryColor || 'emerald',
              })
            }
          }
        } catch { /* silent */ }
      }
      refetchSettings()
    }
  }, [currentPage, isOnline])

  // Fetch user's outlets (enterprise multi-outlet support)
  useEffect(() => {
    const fetchOutlets = async () => {
      if (!isOnline) return
      try {
        const res = await fetch('/api/outlets')
        if (res.ok) {
          const data = await res.json()
          if (data.outlets && Array.isArray(data.outlets)) {
            setUserOutlets(data.outlets.map((o: Record<string, unknown>) => ({
              id: o.id as string,
              name: o.name as string,
              address: (o.address as string) || null,
              phone: (o.phone as string) || null,
              isPrimary: (o.isPrimary as boolean) || false,
            })))
          }
        }
      } catch { /* silent - outlets list is non-critical */ }
      finally {
        setOutletsLoading(false)
      }
    }
    setOutletsLoading(true)
    fetchOutlets()
  }, [isOnline])

  // Customers
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)
  const [addCustomerOpen, setAddCustomerOpen] = useState(false)
  const [newCustomer, setNewCustomer] = useState({ name: '', whatsapp: '' })
  const [addingCustomer, setAddingCustomer] = useState(false)

  // Cart
  const [cart, setCart] = useState<CartItem[]>([])
  const [pointsToUse, setPointsToUse] = useState(0)

  // Promo
  const [selectedPromo, setSelectedPromo] = useState<{ id: string; name: string; type: string; discount: number; description: string } | null>(null)
  const [promoDiscount, setPromoDiscount] = useState(0)
  const [promoLoading, setPromoLoading] = useState(false)
  const [availablePromos, setAvailablePromos] = useState<Array<{ id: string; name: string; type: string; description: string }>>([])

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS' | 'DEBIT'>('CASH')
  const [paidAmount, setPaidAmount] = useState('')

  // Reset payment method if not in available methods
  useEffect(() => {
    if (availablePaymentMethods.length > 0 && !availablePaymentMethods.includes(paymentMethod)) {
      setPaymentMethod(availablePaymentMethods[0])
    }
  }, [availablePaymentMethods, paymentMethod])

  // Fetch available promos
  useEffect(() => {
    const fetchPromos = async () => {
      try {
        const res = await fetch('/api/settings/promos?active=true')
        if (res.ok) {
          const data = await res.json()
          setAvailablePromos(data.promos || [])
        }
      } catch { /* silent */ }
    }
    if (isOnline) fetchPromos()
  }, [isOnline])

  // Calculate promo when cart changes
  useEffect(() => {
    if (cart.length === 0) {
      setSelectedPromo(null)
      setPromoDiscount(0)
      return
    }
    const calculatePromo = async () => {
      setPromoLoading(true)
      try {
        const cartSubtotal = cart.reduce((sum, item) => sum + item.product.price * item.qty, 0)
        const res = await fetch('/api/promos/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cart.map(item => ({
              productId: item.product.id,
              productName: item.product.name,
              price: item.product.price,
              qty: item.qty,
              subtotal: item.product.price * item.qty,
            })),
            subtotal: cartSubtotal,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.applicablePromo) {
            setSelectedPromo(data.applicablePromo)
            setPromoDiscount(data.discount)
          } else {
            setSelectedPromo(null)
            setPromoDiscount(0)
          }
        }
      } catch { /* silent */ }
      finally { setPromoLoading(false) }
    }
    const timer = setTimeout(calculatePromo, 500)
    return () => clearTimeout(timer)
  }, [cart])

  // Checkout
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [mobileCartOpen, setMobileCartOpen] = useState(false)
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null)
  const [editingQtyValue, setEditingQtyValue] = useState('')
  const qtyInputRef = useRef<HTMLInputElement>(null)

  // ── Inline QTY Edit Handlers ──
  const startEditQty = (productId: string, currentQty: number) => {
    setEditingQtyId(productId)
    setEditingQtyValue(String(currentQty))
    setTimeout(() => qtyInputRef.current?.focus(), 50)
  }

  const confirmEditQty = () => {
    if (!editingQtyId) return
    const val = parseInt(editingQtyValue, 10)
    if (isNaN(val) || val <= 0) {
      removeFromCart(editingQtyId)
    } else {
      updateQty(editingQtyId, val)
    }
    setEditingQtyId(null)
    setEditingQtyValue('')
  }

  const cancelEditQty = () => {
    setEditingQtyId(null)
    setEditingQtyValue('')
  }

  // Online/offline detection
  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Live queries for unsynced transactions
  const unsyncedCount = useLiveQuery(
    () => localDB.transactions.where('isSynced').equals(0).count(),
    []
  ) ?? 0

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && initialSyncDone.current && !syncingRef.current) {
      syncingRef.current = true
      const timer = setTimeout(async () => {
        try {
          const pending = await localDB.transactions.where('isSynced').equals(0).toArray()
          if (pending.length > 0) {
            const res = await fetch('/api/transactions/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ transactions: pending }),
            })
            const data = await res.json()
            if (res.ok && data.synced > 0) {
              for (const result of data.results || []) {
                if (result.success) {
                  await localDB.transactions.update(result.localId, {
                    isSynced: 1,
                    syncedAt: Date.now(),
                    invoiceNumber: result.invoiceNumber,
                    serverTransactionId: result.serverId,
                  })
                }
              }
              toast.success(`${data.synced} transaction(s) auto-synced!`)
            }
          }

          setDataSyncing(true)
          const result = await syncAllData()
          syncSettingsFromServer() // cache settings for offline (fire-and-forget)
          fetchProducts(productSearch, productPage, selectedCategoryId)
          loadCategoriesFromCache()
          loadCustomersFromCache()
          const times = await getAllSyncTimes()
          setLastSyncTimes(times)
          setDataSyncing(false)
        } catch {
          setDataSyncing(false)
        } finally {
          syncingRef.current = false
        }
      }, 2000)
      return () => { clearTimeout(timer); syncingRef.current = false }
    }
  }, [isOnline])

  // Initial sync on mount
  useEffect(() => {
    if (isOnline && !initialSyncDone.current) {
      initialSyncDone.current = true
      const doInitialSync = async () => {
        setDataSyncing(true)
        try {
          const result = await syncAllData()
          syncSettingsFromServer() // cache settings for offline (fire-and-forget)
          fetchProducts(productSearch, productPage, selectedCategoryId)
          loadCategoriesFromCache()
          loadCustomersFromCache()
          const times = await getAllSyncTimes()
          setLastSyncTimes(times)
          if (result.products.count > 0 || result.customers.count > 0) {
            toast.success(`Data synced: ${result.products.count} produk, ${result.categories.count} kategori, ${result.customers.count} customer`)
          }
        } catch {
          fetchProducts(productSearch, productPage, selectedCategoryId)
          loadCategoriesFromCache()
          loadCustomersFromCache()
        } finally {
          setDataSyncing(false)
        }
      }
      doInitialSync()
    } else if (!isOnline && !initialSyncDone.current) {
      initialSyncDone.current = true
      fetchProducts(productSearch, productPage, selectedCategoryId)
      loadCategoriesFromCache()
      loadCustomersFromCache()
      getAllSyncTimes().then(setLastSyncTimes)
    }
  }, [isOnline])

  // Auto-focus search
  useEffect(() => {
    if (searchInputRef.current) searchInputRef.current.focus()
  }, [])

  // ==================== DATA LOADING ====================

  const loadCategoriesFromCache = useCallback(async () => {
    try {
      const cached = await localDB.categories.toArray()
      setCategories(cached as unknown as Category[])
    } catch { /* silent */ }
  }, [])

  useEffect(() => { loadCategoriesFromCache() }, [loadCategoriesFromCache])

  const fetchProducts = useCallback(async (search: string, page: number, categoryId: string | null) => {
    setProductsLoading(true)
    try {
      const allProducts = await localDB.products.toArray()

      let filtered = allProducts

      // Category filter
      if (categoryId) {
        filtered = filtered.filter(p => p.categoryId === categoryId)
      }

      // Search filter
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        filtered = filtered.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.sku && p.sku.toLowerCase().includes(q)) ||
            (p.barcode && p.barcode.toLowerCase().includes(q))
        )
      }

      const totalPages = Math.max(1, Math.ceil(filtered.length / PRODUCTS_PER_PAGE))
      const skip = (page - 1) * PRODUCTS_PER_PAGE
      const paged = filtered.slice(skip, skip + PRODUCTS_PER_PAGE)

      setProducts(paged)
      setTotalProductPages(totalPages)
    } catch {
      toast.error('Failed to load products')
    } finally {
      setProductsLoading(false)
    }
  }, [])

  // Debounced fetch
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    const timer = setTimeout(() => {
      fetchProducts(productSearch, productPage, selectedCategoryId)
    }, productSearch ? 200 : 0)
    debounceTimerRef.current = timer
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current) }
  }, [productSearch, productPage, selectedCategoryId, fetchProducts])

  const loadCustomersFromCache = useCallback(async () => {
    try {
      const cached = await localDB.customers.toArray()
      setCustomers(cached as unknown as Customer[])
    } catch { /* silent */ }
  }, [])

  useEffect(() => { loadCustomersFromCache() }, [loadCustomersFromCache])

  // ==================== HANDLERS ====================

  const handleSearchChange = (value: string) => {
    setProductSearch(value)
    setProductPage(1)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && productSearch.trim()) {
      if (products.length === 1 && !productsLoading) {
        const product = products[0]
        if (product.stock > 0) {
          addToCart(product)
          setProductSearch('')
          toast.success(`${product.name} ditambahkan`)
        }
      }
    }
  }

  const handleCategorySelect = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId)
    setProductPage(1)
  }

  // Customer dropdown
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers.slice(0, 20)
    const q = customerSearch.toLowerCase()
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.whatsapp.includes(q)
    )
  }, [customers, customerSearch])

  // ==================== CART LOGIC ====================

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.product.price * item.qty, 0), [cart])
  const maxPointsToUse = selectedCustomer ? selectedCustomer.points : 0
  const pointsDiscount = pointsToUse * settings.loyaltyPointValue
  const total = Math.max(0, subtotal - pointsDiscount - promoDiscount)
  const change = paymentMethod === 'CASH' ? Math.max(0, Number(paidAmount) - total) : 0

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id)
      if (existing) {
        if (existing.qty >= product.stock) { toast.warning('Stok tidak cukup'); return prev }
        return prev.map((item) => item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item)
      }
      return [...prev, { product, qty: 1 }]
    })
  }

  const updateQty = (productId: string, newQty: number) => {
    if (newQty <= 0) { removeFromCart(productId); return }
    const item = cart.find((i) => i.product.id === productId)
    if (item && newQty > item.product.stock) { toast.warning('Stok tidak cukup'); return }
    setCart((prev) => prev.map((i) => (i.product.id === productId ? { ...i, qty: newQty } : i)))
  }

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId))
  }

  const clearCart = () => {
    setCart([])
    setPointsToUse(0)
    setPaidAmount('')
    if (availablePaymentMethods.includes('CASH')) setPaymentMethod('CASH')
    setSelectedCustomer(null)
    setCheckoutResult(null)
    setSelectedPromo(null)
    setPromoDiscount(0)
  }

  const handlePointsChange = (value: string) => {
    setPointsToUse(Math.min(Number(value) || 0, maxPointsToUse))
  }

  // ==================== QUICK NOMINAL ====================

  const getQuickNominals = useMemo(() => {
    if (total <= 0) return QUICK_NOMINALS
    // Generate smart nominals around the total
    const roundedUp = Math.ceil(total / 10000) * 10000
    const roundedDown = Math.floor(total / 10000) * 10000
    const exact = total

    const nominals = new Set<number>()
    nominals.add(Math.round(exact))
    if (roundedUp > exact) nominals.add(roundedUp)
    if (roundedDown > 0 && roundedDown >= exact) nominals.add(roundedDown)

    // Add common denominations above total
    for (const n of QUICK_NOMINALS) {
      if (n >= total) nominals.add(n)
    }

    return Array.from(nominals).sort((a, b) => a - b).slice(0, 6)
  }, [total])

  // ==================== CUSTOMER CREATION ====================

  const handleAddCustomer = async () => {
    if (!newCustomer.name.trim() || !newCustomer.whatsapp.trim()) {
      toast.error('Nama dan nomor WhatsApp wajib diisi')
      return
    }
    const phone = newCustomer.whatsapp.replace(/[^0-9]/g, '')
    if (phone.length < 8) {
      toast.error('Nomor WhatsApp tidak valid')
      return
    }
    setAddingCustomer(true)
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCustomer.name.trim(), whatsapp: phone }),
      })
      if (res.ok) {
        const customer = await res.json()
        toast.success(`Customer ${customer.name} berhasil ditambahkan`)
        setAddCustomerOpen(false)
        setNewCustomer({ name: '', whatsapp: '' })
        setSelectedCustomer({ id: customer.id, name: customer.name, whatsapp: customer.whatsapp, points: 0 })
        setCustomerSearch('')
        setCustomerDropdownOpen(false)
        // Refresh local cache
        loadCustomersFromCache()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Gagal menambahkan customer')
      }
    } catch {
      toast.error('Gagal menambahkan customer')
    } finally {
      setAddingCustomer(false)
    }
  }

  // ==================== CHECKOUT ====================

  const handleCheckout = async () => {
    if (cart.length === 0) return
    if (paymentMethod === 'CASH' && Number(paidAmount) < total) {
      toast.error('Jumlah bayar kurang dari total')
      return
    }
    setCheckingOut(true)
    try {
      const checkoutPayload = {
        customerId: selectedCustomer?.id || null,
        items: cart.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          price: item.product.price,
          qty: item.qty,
          subtotal: item.product.price * item.qty,
        })),
        subtotal,
        discount: pointsDiscount + promoDiscount,
        pointsUsed: pointsToUse,
        total,
        paymentMethod,
        paidAmount: paymentMethod === 'CASH' ? Number(paidAmount) : total,
        change: paymentMethod === 'CASH' ? change : 0,
        promoId: selectedPromo?.id || null,
        promoDiscount,
      }

      // STEP 1: Save to IndexedDB first
      const localId = await localDB.transactions.add({
        payload: checkoutPayload,
        isSynced: 0,
        createdAt: Date.now(),
        retryCount: 0,
      })

      // STEP 1b: Decrement stock locally in IndexedDB to prevent overselling while offline
      for (const item of cart) {
        await localDB.products
          .where('id')
          .equals(item.product.id)
          .modify((p) => {
            p.stock = Math.max(0, (p.stock || 0) - item.qty)
            p.updatedAt = new Date().toISOString()
          })
      }

      // STEP 2: If online, sync immediately
      if (isOnline) {
        try {
          const unsyncedTx = await localDB.transactions.get(localId)
          if (unsyncedTx) {
            const syncRes = await fetch('/api/transactions/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ transactions: [unsyncedTx] }),
            })
            const syncData = await syncRes.json()
            if (syncRes.ok && syncData.synced > 0) {
              await localDB.transactions.update(localId, {
                isSynced: 1,
                syncedAt: Date.now(),
                invoiceNumber: syncData.results?.[0]?.invoiceNumber,
                serverTransactionId: syncData.results?.[0]?.serverId,
              })
              const invoiceNum = syncData.results?.[0]?.invoiceNumber || `OFF-${Date.now().toString(36).toUpperCase()}`
              setCheckoutResult({ success: true, invoiceNumber: invoiceNum })
              toast.success(`Pembayaran berhasil! Invoice: ${invoiceNum}`)
            } else {
              const error = syncData.results?.[0]?.error || 'Gagal sync ke server'
              const invoiceNum = `OFF-${Date.now().toString(36).toUpperCase()}`
              setCheckoutResult({ success: true, invoiceNumber: invoiceNum, message: 'Tersimpan lokal', syncError: error })
              toast.warning('Tersimpan lokal — akan sync otomatis', { description: error })
            }
          }
        } catch (syncErr) {
          console.error('Immediate sync failed:', syncErr)
          const invoiceNum = `OFF-${Date.now().toString(36).toUpperCase()}`
          setCheckoutResult({ success: true, invoiceNumber: invoiceNum, message: 'Tersimpan offline', syncError: 'Tidak dapat terhubung ke server' })
          toast.warning('Tersimpan offline — akan sync otomatis')
        }
      } else {
        const invoiceNum = `OFF-${Date.now().toString(36).toUpperCase()}`
        setCheckoutResult({ success: true, invoiceNumber: invoiceNum, message: 'Transaksi offline' })
        toast.warning('Offline — transaksi tersimpan lokal', { duration: 5000 })
      }

      setCheckoutOpen(false)
      setReceiptOpen(true)
      fetchProducts(productSearch, productPage, selectedCategoryId)
      loadCustomersFromCache()
    } catch {
      toast.error('Checkout gagal')
    } finally {
      setCheckingOut(false)
    }
  }

  const openCheckoutDialog = () => {
    if (cart.length === 0) return
    setCheckoutResult(null)
    setCheckoutOpen(true)
  }

  // ==================== RECEIPT PRINTING ====================

  const handleReceiptPrint = () => {
    const content = receiptContentRef.current?.innerHTML
    if (!content) return
    const win = window.open('', '_blank', 'width=320,height=800')
    if (!win) { toast.error('Gagal membuka jendela cetak'); return }
    win.document.write(`<!DOCTYPE html><html><head><title>Receipt</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 13px; width: 300px; margin: 0 auto; padding: 12px 10px; color: #000; font-weight: 600; line-height: 1.5; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: 800; }
        .font-semibold { font-weight: 700; }
        .font-medium { font-weight: 600; }
        .text-sm { font-size: 12px; }
        .text-xs { font-size: 11px; }
        .text-[11px] { font-size: 11px; font-weight: 600; }
        .space-y-1 > * + * { margin-top: 5px; }
        .space-y-0\.5 > * + * { margin-top: 2px; }
        .space-y-1\.5 > * + * { margin-top: 7px; }
        .space-y-2 > * + * { margin-top: 10px; }
        .py-2 { padding-top: 10px; padding-bottom: 10px; }
        .py-1 { padding-top: 5px; padding-bottom: 5px; }
        .my-2 { margin-top: 10px; margin-bottom: 10px; }
        .mt-2 { margin-top: 10px; }
        .border-t, .border-dashed { border-top: 1.5px dashed #555; }
        .border-zinc-300 { border-color: #555; }
        .flex { display: flex; justify-content: space-between; align-items: baseline; }
        .text-zinc-500 { color: #444; font-weight: 600; }
        .text-zinc-600 { color: #555; font-weight: 600; }
        .text-zinc-400 { color: #777; }
        .text-emerald-600 { color: #059669; }
        .text-zinc-900 { color: #000; font-weight: 700; }
        .text-base { font-size: 18px; }
        .text-amber-600 { color: #b45309; }
        .uppercase { text-transform: uppercase; }
        .items-center { align-items: center; }
        .gap-1 { gap: 4px; }
        .inline-flex { display: inline-flex; }
        @media print {
          body { margin: 0; padding: 8px 6px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 0; size: 80mm auto; }
        }
      </style>
    </head><body>${content}</body></html>`)
    win.document.close()
    setTimeout(() => { win.print(); setTimeout(() => win.close(), 500) }, 250)
    setReceiptOpen(false)
    clearCart()
  }

  const handleReceiptSkip = () => {
    setReceiptOpen(false)
    clearCart()
  }

  // ==================== SYNC ====================

  const handleSync = async () => {
    if (syncing || unsyncedCount === 0) return
    setSyncing(true)
    try {
      const pending = await localDB.transactions.where('isSynced').equals(0).toArray()
      if (pending.length === 0) { toast.info('Tidak ada transaksi pending'); return }

      const res = await fetch('/api/transactions/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: pending }),
      })
      const data = await res.json()

      if (res.ok) {
        for (const result of data.results || []) {
          if (result.success) {
            await localDB.transactions.update(result.localId, {
              isSynced: 1, syncedAt: Date.now(),
              invoiceNumber: result.invoiceNumber, serverTransactionId: result.serverId,
            })
          } else {
            const existing = await localDB.transactions.get(result.localId)
            await localDB.transactions.update(result.localId, {
              retryCount: (existing?.retryCount || 0) + 1, lastError: result.error,
            })
          }
        }
        if (data.synced > 0) {
          toast.success(`${data.synced} transaksi berhasil disync!`)
          fetchProducts(productSearch, productPage, selectedCategoryId)
          loadCustomersFromCache()
        }
        if (data.failed > 0) {
          toast.error(`${data.failed} transaksi gagal sync`, { description: 'Periksa stok produk.' })
        }
      } else {
        toast.error('Sync gagal — server error')
      }
    } catch {
      toast.error('Sync gagal — tidak ada koneksi internet')
    } finally {
      setSyncing(false)
    }
  }

  // ==================== RECEIPT CONTENT ====================

  const formatReceiptDateTime = () => {
    const now = new Date()
    return `${now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
  }

  const isOfflineReceipt = checkoutResult?.invoiceNumber?.startsWith('OFF-')

  // ==================== THEME COLORS ====================

  const themeColors = CATEGORY_COLORS[settings.themePrimaryColor] || CATEGORY_COLORS.emerald

  // ==================== RENDER HELPERS ====================

  const renderCategoryChips = () => (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-1">
      <button
        onClick={() => handleCategorySelect(null)}
        className={`shrink-0 px-3 py-1.5 sm:px-3 sm:py-1.5 rounded-full text-[11px] font-medium border transition-all backdrop-blur-sm ${
          !selectedCategoryId
            ? `${themeColors.activeBg} ${themeColors.text} ${themeColors.border} shadow-sm`
            : 'bg-zinc-900/60 border-zinc-800/60 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
        }`}
      >
        <LayoutGrid className="inline h-3 w-3 mr-1 -mt-0.5" />
        Semua
      </button>
      {categories.map((cat) => {
        const colors = CATEGORY_COLORS[cat.color] || CATEGORY_COLORS.zinc
        const isActive = selectedCategoryId === cat.id
        return (
          <button
            key={cat.id}
            onClick={() => handleCategorySelect(cat.id)}
            className={`shrink-0 px-3 py-1.5 sm:px-3 sm:py-1.5 rounded-full text-[11px] font-medium border transition-all backdrop-blur-sm ${
              isActive
                ? `${colors.activeBg} ${colors.text} ${colors.border} shadow-sm`
                : 'bg-zinc-900/60 border-zinc-800/60 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
            }`}
          >
            {cat.name}
          </button>
        )
      })}
    </div>
  )

  const renderProductGrid = () => {
    if (productsLoading) {
      return Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-[88px] md:h-[72px] rounded-xl bg-zinc-800/20 animate-pulse" />
      ))
    }

    if (products.length === 0) {
      return (
        <div className="col-span-full text-center py-12">
          <Package className="h-10 w-10 text-zinc-700 mx-auto mb-2" />
          <p className="text-xs text-zinc-500">
            {selectedCategoryId ? 'Tidak ada produk di kategori ini' : 'Tidak ada produk ditemukan'}
          </p>
        </div>
      )
    }

    return products.map((product) => {
      const cartItem = cart.find((i) => i.product.id === product.id)
      const outOfStock = product.stock <= 0
      const catColor = product.categoryId && categories.find(c => c.id === product.categoryId)?.color
      const accentColor = catColor ? (CATEGORY_COLORS[catColor] || themeColors) : themeColors
      const lowStock = product.stock > 0 && product.stock <= 5

      return (
        <button
          key={product.id}
          onClick={() => !outOfStock && addToCart(product)}
          disabled={outOfStock}
          className={cn(
            'relative group p-3.5 md:p-3 min-h-[80px] md:min-h-0 rounded-2xl md:rounded-xl border text-left transition-all duration-200 active:scale-[0.98]',
            outOfStock
              ? 'opacity-40 cursor-not-allowed border-zinc-800/40 bg-zinc-900/30'
              : cartItem
              ? `${accentColor.border} ${accentColor.bg} hover:shadow-lg hover:shadow-emerald-500/5 ring-1 ring-inset ${accentColor.border.replace('border-', 'ring-')}`
              : 'border-zinc-800/50 bg-zinc-900/60 hover:border-zinc-700/60 hover:bg-zinc-800/50 hover:shadow-lg hover:shadow-black/20 backdrop-blur-sm'
          )}
        >
          {cartItem && (
            editingQtyId === cartItem.product.id ? (
              <input
                ref={qtyInputRef}
                type="number"
                min="0"
                max={cartItem.product.stock}
                value={editingQtyValue}
                onChange={(e) => setEditingQtyValue(e.target.value)}
                onBlur={confirmEditQty}
                onKeyDown={(e) => { if (e.key === 'Enter') confirmEditQty(); if (e.key === 'Escape') cancelEditQty() }}
                onClick={(e) => e.stopPropagation()}
                className="absolute -top-2 -right-2 w-10 h-6 rounded-full bg-emerald-500 text-white text-[11px] font-bold text-center border-2 border-white shadow-lg z-10 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            ) : (
              <div
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center shadow-lg shadow-emerald-500/30 z-10 cursor-pointer hover:scale-110 active:scale-95 transition-transform"
                onClick={(e) => { e.stopPropagation(); startEditQty(cartItem.product.id, cartItem.qty) }}
              >
                {cartItem.qty}
              </div>
            )
          )}
          <p className="text-xs font-medium text-zinc-200 truncate mb-1.5 pr-6">{product.name}</p>
          <p className={`text-sm font-bold ${accentColor.text}`}>{formatCurrency(product.price)}</p>
          <div className="flex items-center justify-between mt-1.5">
            {outOfStock ? (
              <span className="text-[10px] text-red-400 font-medium">Habis</span>
            ) : (
              <span className={cn(
                'inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium',
                lowStock
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-zinc-800/80 text-zinc-500'
              )}>
                <span className={cn('w-1 h-1 rounded-full', lowStock ? 'bg-amber-400' : 'bg-zinc-600')} />
                {product.stock}
              </span>
            )}
          </div>
        </button>
      )
    })
  }

  const renderPagination = () => {
    if (totalProductPages <= 1 && !productSearch) return null
    return (
      <div className="flex items-center justify-between px-1 py-2">
        <Button variant="outline" size="sm" onClick={() => setProductPage(p => Math.max(1, p - 1))} disabled={productPage <= 1 || productsLoading}
          className="bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 h-7 text-xs">
          <ChevronLeft className="h-3 w-3 mr-1" /> Prev
        </Button>
        <span className="text-[11px] text-zinc-500 font-medium">{productPage}/{totalProductPages}</span>
        <Button variant="outline" size="sm" onClick={() => setProductPage(p => Math.min(totalProductPages, p + 1))} disabled={productPage >= totalProductPages || productsLoading}
          className="bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 h-7 text-xs">
          Next <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    )
  }

  const renderPaymentButtons = (compact = false) => {
    if (availablePaymentMethods.length === 0) return null
    return (
      <div className="flex gap-2">
        {availablePaymentMethods.map(method => {
          const icons: Record<string, React.ReactNode> = { CASH: <Banknote className="h-3.5 w-3.5" />, QRIS: <QrCode className="h-3.5 w-3.5" />, DEBIT: <CreditCard className="h-3.5 w-3.5" /> }
          const isActive = paymentMethod === method
          return (
            <button key={method} onClick={() => setPaymentMethod(method as 'CASH' | 'QRIS' | 'DEBIT')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-full border text-xs font-medium transition-all duration-150',
                compact ? 'h-9 py-2' : 'h-10 py-2.5',
                isActive
                  ? `${themeColors.activeBg} ${themeColors.text} ${themeColors.border} shadow-sm ring-1 ring-inset ${themeColors.border.replace('border-', 'ring-')}`
                  : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 hover:border-zinc-600'
              )}>
              {icons[method]} {method}
            </button>
          )
        })}
      </div>
    )
  }

  const renderCustomerSelector = (isMobile = false) => (
    <div className={isMobile ? 'bg-zinc-900/80 border border-zinc-800/60 rounded-2xl p-3.5 space-y-2' : 'border-b border-zinc-800 px-4 py-3'}>
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-zinc-500 font-medium tracking-wide uppercase">Customer</Label>
        <button onClick={() => setAddCustomerOpen(true)} className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition-colors">
          <UserPlus className="h-3 w-3" /> Tambah Baru
        </button>
      </div>
      <div className="relative">
        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input
          placeholder={selectedCustomer ? selectedCustomer.name : 'Cari customer (walk-in jika kosong)'}
          value={customerSearch}
          onChange={(e) => { setCustomerSearch(e.target.value); setCustomerDropdownOpen(true) }}
          onFocus={() => setCustomerDropdownOpen(true)}
          className="pl-10 pr-8 h-10 text-sm bg-zinc-800/50 border-zinc-700/60 text-zinc-100 placeholder:text-zinc-500 rounded-xl backdrop-blur-sm"
        />
        {selectedCustomer && (
          <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); setPointsToUse(0) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-full bg-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {customerDropdownOpen && filteredCustomers.length > 0 && !selectedCustomer && (
        <div className={`absolute z-30 ${isMobile ? 'w-[calc(100%-1.75rem)]' : 'w-full'} mt-1 bg-zinc-900 border border-zinc-700/60 rounded-2xl shadow-2xl shadow-black/40 max-h-44 overflow-y-auto backdrop-blur-xl`}>
          {filteredCustomers.map((customer) => (
            <button key={customer.id} onClick={() => { setSelectedCustomer(customer); setCustomerSearch(''); setCustomerDropdownOpen(false); setPointsToUse(0) }}
              className="w-full text-left px-4 py-2.5 hover:bg-zinc-800/80 border-b border-zinc-800/40 last:border-0 transition-colors first:rounded-t-2xl last:rounded-b-2xl">
              <p className="text-xs text-zinc-200 font-medium">{customer.name}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{customer.whatsapp} · <span className="text-amber-400">{customer.points} pts</span></p>
            </button>
          ))}
        </div>
      )}
      {selectedCustomer && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <User className="h-3 w-3 text-emerald-400" />
            <span className="text-[11px] text-emerald-300 font-medium">{selectedCustomer.name}</span>
          </div>
          {selectedCustomer.points > 0 && (
            <Badge className="bg-amber-500/10 border-amber-500/20 text-amber-400 text-[10px] rounded-lg">
              <Coins className="mr-1 h-2.5 w-2.5" />
              {selectedCustomer.points} poin
            </Badge>
          )}
        </div>
      )}
    </div>
  )

  // ==================== RECEIPT RENDERER ====================

  const renderReceiptContent = () => {
    if (!checkoutResult) return null
    return (
      <div ref={receiptContentRef} className="space-y-2">
        {/* Header — Business Info */}
        <div className="text-center space-y-2 py-3">
          {settings.receiptLogo && <p className="text-lg font-bold">LOGO</p>}
          <p className="text-lg font-bold">{settings.receiptBusinessName}</p>
          {settings.receiptAddress && <p className="text-xs text-zinc-500">{settings.receiptAddress}</p>}
          {settings.receiptPhone && <p className="text-xs text-zinc-500">{settings.receiptPhone}</p>}
        </div>

        <div className="border-t border-dashed border-zinc-300 my-2" />

        {/* Transaction Info */}
        <div className="space-y-1 py-2">
          <div className="flex"><span className="text-zinc-500">Invoice</span><span className="font-bold">{checkoutResult.invoiceNumber}</span></div>
          <div className="flex"><span className="text-zinc-500">Tanggal</span><span className="font-medium">{formatReceiptDateTime()}</span></div>
          <div className="flex"><span className="text-zinc-500">Customer</span><span className="font-medium">{selectedCustomer ? selectedCustomer.name : 'Walk-in'}</span></div>
          {isOfflineReceipt && <div className="flex"><span className="text-amber-600 text-xs">Status</span><span className="text-amber-600 text-xs font-semibold">Offline — Pending Sync</span></div>}
        </div>

        <div className="border-t border-dashed border-zinc-300 my-2" />

        {/* Items Table Header */}
        <div className="flex items-center py-1">
          <span className="flex-1 text-xs font-bold text-zinc-500">ITEM</span>
          <span className="w-12 text-center text-xs font-bold text-zinc-500">QTY</span>
          <span className="w-16 text-right text-xs font-bold text-zinc-500">HARGA</span>
          <span className="w-20 text-right text-xs font-bold text-zinc-500">SUBTOTAL</span>
        </div>
        <div className="border-t border-dashed border-zinc-300" />

        {/* Items */}
        <div className="space-y-2 py-2">
          {cart.map((item) => (
            <div key={item.product.id} className="space-y-0.5">
              <p className="font-semibold text-xs">{item.product.name}</p>
              <div className="flex items-center">
                <span className="flex-1 text-[11px] text-zinc-600">{formatCurrency(item.product.price)}/pcs</span>
                <span className="w-12 text-center text-[11px] font-bold">{item.qty}</span>
                <span className="w-16 text-right text-[11px] text-zinc-600">{formatCurrency(item.product.price)}</span>
                <span className="w-20 text-right text-xs font-bold">{formatCurrency(item.product.price * item.qty)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-zinc-300 my-2" />

        {/* Totals */}
        <div className="space-y-1 py-2">
          <div className="flex"><span className="text-zinc-500">Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
          {pointsDiscount > 0 && <div className="flex text-emerald-600"><span className="font-medium">Poin Diskon</span><span className="font-bold">-{formatCurrency(pointsDiscount)}</span></div>}
          {promoDiscount > 0 && selectedPromo && <div className="flex text-amber-600"><span className="font-medium">Promo: {selectedPromo.name}</span><span className="font-bold">-{formatCurrency(promoDiscount)}</span></div>}
          <div className="border-t border-dashed border-zinc-300 my-2" />
          <div className="flex text-base font-bold"><span>TOTAL</span><span>{formatCurrency(total)}</span></div>
        </div>

        <div className="border-t border-dashed border-zinc-300 my-2" />

        {/* Payment */}
        <div className="space-y-1 py-2">
          <div className="flex"><span className="text-zinc-500">Pembayaran</span><span className="font-bold uppercase">{paymentMethod}</span></div>
          <div className="flex"><span className="text-zinc-500">Dibayar</span><span className="font-medium">{formatCurrency(paymentMethod === 'CASH' ? Number(paidAmount) : total)}</span></div>
          {paymentMethod === 'CASH' && change > 0 && <div className="flex font-bold"><span>Kembalian</span><span>{formatCurrency(change)}</span></div>}
        </div>

        {/* Footer */}
        {settings.receiptFooter && (
          <>
            <div className="border-t border-dashed border-zinc-300 my-2" />
            <div className="text-center py-3">
              <p className="text-xs text-zinc-400">{settings.receiptFooter}</p>
            </div>
          </>
        )}
      </div>
    )
  }

  // ==================== MAIN RENDER ====================

  return (
    <div className="space-y-3">
      {/* Header — Mobile Compact */}
      <div className="md:hidden flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {outletInfo ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] font-semibold text-zinc-300 min-w-0">
              <Store className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">{outletInfo.name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] font-medium text-zinc-600">
              <Store className="h-3.5 w-3.5" />
              <span>No outlet</span>
            </div>
          )}
          <div className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-[10px] font-medium border shrink-0 ${
            isOnline ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          </div>
          {unsyncedCount > 0 && (
            <button onClick={handleSync} disabled={syncing || !isOnline}
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-medium shrink-0 disabled:opacity-50">
              {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              {unsyncedCount}
            </button>
          )}
        </div>
        <button onClick={async () => {
          if (dataSyncing || !isOnline) return
          setDataSyncing(true)
          try {
            const result = await syncAllData()
            fetchProducts(productSearch, productPage, selectedCategoryId)
            loadCategoriesFromCache()
            loadCustomersFromCache()
            const times = await getAllSyncTimes()
            setLastSyncTimes(times)
            toast.success(`Data direfresh: ${result.products.count} produk, ${result.customers.count} customer`)
          } catch { toast.error('Gagal refresh data') }
          finally { setDataSyncing(false) }
        }} disabled={dataSyncing || !isOnline}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 text-[10px] font-medium shrink-0 disabled:opacity-50">
          {dataSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowDownToLine className="h-3 w-3" />}
        </button>
      </div>

      {/* Header — Desktop Full */}
      <div className="hidden md:flex md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-bold text-zinc-100">Point of Sale</h1>
            <p className="text-[11px] text-zinc-500">Proses transaksi & terima pembayaran</p>
          </div>

          {/* Outlet Selector */}
          {userOutlets.length > 1 ? (
            <Select
              value={outletInfo?.id || ''}
              onValueChange={(value) => {
                const selectedOutlet = userOutlets.find(o => o.id === value)
                if (selectedOutlet && selectedOutlet.id !== outletInfo?.id) {
                  toast.info(`Switching to "${selectedOutlet.name}"...`, {
                    description: 'Data will reload for the selected outlet.',
                    duration: 3000,
                  })
                  setOutletInfo({
                    id: selectedOutlet.id,
                    name: selectedOutlet.name,
                    address: selectedOutlet.address,
                    phone: selectedOutlet.phone,
                  })
                }
              }}
            >
              <SelectTrigger className="w-auto min-w-[180px] max-w-[220px] h-8 bg-zinc-900 border-zinc-700 text-zinc-200 text-xs rounded-lg gap-1.5 pr-2">
                <Store className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                <SelectValue placeholder={outletsLoading ? 'Loading...' : 'Select outlet'} />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                {userOutlets.map((outlet) => (
                  <SelectItem key={outlet.id} value={outlet.id} className="text-xs text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100">
                    <div className="flex items-center gap-2">
                      <Store className="h-3.5 w-3.5 text-zinc-500" />
                      <span>{outlet.name}</span>
                      {outlet.isPrimary && (
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-medium">
                          Primary
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : outletInfo ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800/80 border border-zinc-700 text-[11px] font-medium text-zinc-400">
              <Store className="h-3 w-3" />
              <span>{outletInfo.name}</span>
            </div>
          ) : !outletsLoading ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800/50 border border-zinc-800 text-[11px] font-medium text-zinc-600">
              <Store className="h-3 w-3" />
              <span>No outlet</span>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Connection */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
            isOnline ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {isOnline ? <><Wifi className="h-3 w-3" /><span>Online</span></> : <><WifiOff className="h-3 w-3" /><span>Offline</span></>}
          </div>

          {/* Data sync */}
          {lastSyncTimes.products ? (
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
              dataSyncing ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-zinc-800/80 border-zinc-700 text-zinc-500'
            }`}>
              {dataSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
              <span>{dataSyncing ? 'Syncing...' : 'Cached'}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-medium">
              <Database className="h-3 w-3" /><span>No cache</span>
            </div>
          )}

          {/* Unsynced */}
          {unsyncedCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-medium">
              <CloudOff className="h-3 w-3" /><span>{unsyncedCount} pending</span>
            </div>
          )}

          {/* Buttons */}
          <Button onClick={async () => {
            if (dataSyncing || !isOnline) return
            setDataSyncing(true)
            try {
              const result = await syncAllData()
              fetchProducts(productSearch, productPage, selectedCategoryId)
              loadCategoriesFromCache()
              loadCustomersFromCache()
              const times = await getAllSyncTimes()
              setLastSyncTimes(times)
              toast.success(`Data direfresh: ${result.products.count} produk, ${result.customers.count} customer`)
            } catch { toast.error('Gagal refresh data') }
            finally { setDataSyncing(false) }
          }} disabled={dataSyncing || !isOnline} variant="outline" size="sm"
            className="bg-zinc-800/80 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-50 h-7 text-xs gap-1.5">
            {dataSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowDownToLine className="h-3 w-3" />}
            Refresh
          </Button>

          {unsyncedCount > 0 && (
            <Button onClick={handleSync} disabled={syncing || !isOnline} variant="outline" size="sm"
              className="bg-amber-600/20 border-amber-500/30 text-amber-400 hover:bg-amber-600/30 disabled:opacity-50 h-7 text-xs gap-1.5">
              {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Sync {unsyncedCount}
            </Button>
          )}
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:grid md:grid-cols-5 gap-4 min-h-[calc(100vh-10rem)]">
        {/* Products - Left */}
        <div className="md:col-span-3 flex flex-col">
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              ref={searchInputRef}
              placeholder="Scan barcode atau cari produk..."
              value={productSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="pl-10 h-10 text-sm bg-zinc-900/80 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 rounded-xl"
            />
          </div>

          {/* Category Chips */}
          {renderCategoryChips()}

          {/* Product Grid */}
          <ScrollArea className="flex-1">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 pb-3">
              {renderProductGrid()}
            </div>
          </ScrollArea>
          {renderPagination()}
        </div>

        {/* Cart - Right */}
        <div className="md:col-span-2 flex flex-col bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl shadow-black/10">
          <div className="py-3 px-4 border-b border-zinc-800 bg-zinc-900">
            <h2 className="text-xs font-bold text-zinc-300 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <ShoppingCart className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              Keranjang
              {cart.length > 0 && (
                <span className="ml-auto bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{cart.reduce((s, i) => s + i.qty, 0)}</span>
              )}
            </h2>
          </div>

          {renderCustomerSelector(false)}

          <ScrollArea className="flex-1 px-4 py-2">
            {cart.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                  <ShoppingCart className="h-7 w-7 text-zinc-600" />
                </div>
                <p className="text-zinc-500 text-xs">Keranjang kosong</p>
                <p className="text-zinc-600 text-[10px] mt-0.5">Pilih produk untuk memulai</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-zinc-800/50 border border-zinc-800/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-zinc-200 truncate">{item.product.name}</p>
                      <p className="text-[11px] text-zinc-500">{formatCurrency(item.product.price)} × {item.qty}</p>
                      <p className="text-xs text-emerald-400 font-bold mt-0.5">{formatCurrency(item.product.price * item.qty)}</p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-700 rounded-md"
                        onClick={() => updateQty(item.product.id, item.qty - 1)}><Minus className="h-3.5 w-3.5" /></Button>
                      {editingQtyId === item.product.id ? (
                        <input
                          ref={qtyInputRef}
                          type="number"
                          min="0"
                          max={item.product.stock}
                          value={editingQtyValue}
                          onChange={(e) => setEditingQtyValue(e.target.value)}
                          onBlur={confirmEditQty}
                          onKeyDown={(e) => { if (e.key === 'Enter') confirmEditQty(); if (e.key === 'Escape') cancelEditQty() }}
                          className="text-xs text-zinc-200 w-10 text-center font-bold bg-zinc-700 border border-zinc-600 rounded-md h-8 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      ) : (
                        <span
                          className="text-xs text-zinc-200 w-6 text-center font-bold cursor-pointer hover:text-emerald-400 transition-colors"
                          onClick={() => startEditQty(item.product.id, item.qty)}
                          title="Klik untuk edit qty"
                        >{item.qty}</span>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-700 rounded-md"
                        onClick={() => updateQty(item.product.id, item.qty + 1)}><Plus className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-md ml-0.5"
                        onClick={() => removeFromCart(item.product.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Summary & Payment */}
          <div className="border-t border-zinc-800 p-4 space-y-3 bg-zinc-900">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-zinc-400"><span>Subtotal</span><span className="text-zinc-200">{formatCurrency(subtotal)}</span></div>
              {settings.loyaltyEnabled && selectedCustomer && maxPointsToUse > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 flex items-center gap-1"><Coins className="h-2.5 w-2.5" /> Pakai Poin</span>
                  <Input type="number" min="0" max={maxPointsToUse} value={pointsToUse || ''} onChange={(e) => handlePointsChange(e.target.value)}
                    placeholder="0" className="w-20 h-7 text-right text-[11px] bg-zinc-800 border-zinc-700 text-zinc-100 rounded-md" />
                </div>
              )}
              {pointsDiscount > 0 && (
                <div className="flex justify-between text-emerald-400"><span>Diskon Poin</span><span>-{formatCurrency(pointsDiscount)}</span></div>
              )}
              {promoDiscount > 0 && selectedPromo && (
                <div className="flex justify-between text-amber-400 text-xs">
                  <span className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    Promo: {selectedPromo.name}
                  </span>
                  <span>-{formatCurrency(promoDiscount)}</span>
                </div>
              )}
              <Separator className="bg-zinc-800" />
              <div className="flex justify-between text-base font-black text-zinc-100"><span>Total</span><span>{formatCurrency(total)}</span></div>
            </div>

            {renderPaymentButtons(false)}

            {paymentMethod === 'CASH' && (
              <div className="space-y-2">
                <Label className="text-[11px] text-zinc-400 font-medium">Jumlah Bayar</Label>
                <Input type="number" min="0" step="any" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder="0" className="h-10 text-base font-bold bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 rounded-xl text-right pr-12" />
                {Number(paidAmount) >= total && total > 0 && (
                  <div className="flex justify-between text-xs text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-1.5">
                    <span>Kembalian</span><span className="font-bold">{formatCurrency(change)}</span>
                  </div>
                )}
                {/* Quick Nominals */}
                <div className="flex flex-wrap gap-1.5">
                  {getQuickNominals.map((nom) => (
                    <button key={nom} onClick={() => setPaidAmount(String(nom))}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                        Number(paidAmount) === nom
                          ? `${themeColors.activeBg} ${themeColors.text} ${themeColors.border}`
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                      }`}>
                      {nom >= 1000 ? `${nom / 1000}K` : nom}
                    </button>
                  ))}
                  {total > 0 && (
                    <button onClick={() => setPaidAmount(String(Math.ceil(total / 1000) * 1000))}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium border bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition-all">
                      Uang Pas
                    </button>
                  )}
                </div>
              </div>
            )}

            {paymentMethod === 'QRIS' && (
              <div className="p-4 rounded-xl bg-zinc-800 border border-zinc-700 text-center">
                <QrCode className="h-14 w-14 text-zinc-600 mx-auto mb-2" />
                <p className="text-[11px] text-zinc-400">Scan QRIS untuk bayar</p>
                <p className="text-sm font-black text-zinc-200 mt-1">{formatCurrency(total)}</p>
              </div>
            )}

            {paymentMethod === 'DEBIT' && (
              <div className="p-4 rounded-xl bg-zinc-800 border border-zinc-700 text-center">
                <CreditCard className="h-14 w-14 text-zinc-600 mx-auto mb-2" />
                <p className="text-[11px] text-zinc-400">Tap atau gesek kartu debit</p>
                <p className="text-sm font-black text-zinc-200 mt-1">{formatCurrency(total)}</p>
              </div>
            )}

            <Button onClick={openCheckoutDialog} disabled={cart.length === 0 || checkingOut}
              className={`w-full h-11 font-bold text-sm rounded-xl transition-all ${
                cart.length > 0
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30'
                  : 'bg-zinc-800 text-zinc-500'
              }`}>
              {checkingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Proses Pembayaran
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Layout — Product view + floating cart */}
      <div className="md:hidden">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            ref={searchInputRef}
            placeholder="Cari produk..."
            value={productSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-10 h-11 text-sm bg-zinc-900/80 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 rounded-xl"
          />
        </div>
        {renderCategoryChips()}
        <div className="grid grid-cols-2 gap-2.5 pb-24">{renderProductGrid()}</div>
        {renderPagination()}

        {/* Floating Cart Button */}
        {cart.length > 0 && (
          <button
            onClick={() => setMobileCartOpen(true)}
            className="fixed bottom-20 right-4 z-40 flex items-center gap-2.5 h-14 pl-4 pr-5 rounded-2xl bg-emerald-500 text-white font-bold text-sm shadow-xl shadow-emerald-500/30 hover:bg-emerald-600 active:scale-95 transition-all duration-150"
          >
            <ShoppingCart className="h-5 w-5" />
            <span className="flex flex-col items-start leading-tight">
              <span className="text-[10px] font-medium text-emerald-100">{cart.reduce((s, i) => s + i.qty, 0)} item</span>
              <span className="text-sm">{formatCurrency(total)}</span>
            </span>
          </button>
        )}
      </div>

      {/* ── Mobile Cart Sheet ── */}
      <Sheet open={mobileCartOpen} onOpenChange={(open) => { if (!open) setMobileCartOpen(false) }}>
        <SheetContent side="bottom" className="bg-zinc-950 border-zinc-800 rounded-t-3xl h-[85vh] max-h-[85vh] overflow-hidden flex flex-col px-0 gap-0">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-zinc-700" />
          </div>
          <SheetHeader className="px-5 pb-3 shrink-0">
            <SheetTitle className="text-zinc-100 text-base font-bold flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <ShoppingCart className="h-4 w-4 text-emerald-400" />
              </div>
              Keranjang
              {cart.length > 0 && (
                <span className="ml-auto text-[11px] font-medium text-zinc-500 bg-zinc-800 px-2.5 py-0.5 rounded-full">{cart.reduce((s, i) => s + i.qty, 0)} item</span>
              )}
            </SheetTitle>
          </SheetHeader>

          {/* Customer selector */}
          <div className="shrink-0 px-5 pb-3">{renderCustomerSelector(true)}</div>

          {/* Scrollable items */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5">
            {cart.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-3">
                  <ShoppingCart className="h-7 w-7 text-zinc-700" />
                </div>
                <p className="text-zinc-500 text-sm">Keranjang kosong</p>
                <p className="text-zinc-600 text-xs mt-1">Pilih produk untuk memulai</p>
              </div>
            ) : (
              <div className="space-y-2 pb-2">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex items-center gap-2.5 p-3 rounded-2xl bg-zinc-900 border border-zinc-800/60">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-zinc-200 font-medium truncate">{item.product.name}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{formatCurrency(item.product.price)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button className="h-8 w-8 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-700 transition-colors active:scale-95"
                        onClick={() => updateQty(item.product.id, item.qty - 1)}><Minus className="h-3.5 w-3.5" /></button>
                      {editingQtyId === item.product.id ? (
                        <input
                          ref={qtyInputRef}
                          type="number"
                          min="0"
                          max={item.product.stock}
                          value={editingQtyValue}
                          onChange={(e) => setEditingQtyValue(e.target.value)}
                          onBlur={confirmEditQty}
                          onKeyDown={(e) => { if (e.key === 'Enter') confirmEditQty(); if (e.key === 'Escape') cancelEditQty() }}
                          className="text-xs text-zinc-200 w-12 text-center font-bold bg-zinc-700 border border-zinc-600 rounded-lg h-8 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      ) : (
                        <span
                          className="text-xs w-7 text-center text-zinc-200 font-bold cursor-pointer hover:text-emerald-400 transition-colors"
                          onClick={() => startEditQty(item.product.id, item.qty)}
                        >{item.qty}</span>
                      )}
                      <button className="h-8 w-8 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-500 hover:text-zinc-100 hover:bg-zinc-700 transition-colors active:scale-95"
                        onClick={() => updateQty(item.product.id, item.qty + 1)}><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="text-right shrink-0 min-w-[70px]">
                      <p className="text-[13px] text-emerald-400 font-bold">{formatCurrency(item.product.price * item.qty)}</p>
                    </div>
                    <button className="h-7 w-7 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                      onClick={() => removeFromCart(item.product.id)}><Trash2 className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sticky footer: Total + Bayar */}
          {cart.length > 0 && (
            <div className="shrink-0 border-t border-zinc-800 bg-zinc-950 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {/* Discount info (compact) */}
              {(pointsDiscount > 0 || promoDiscount > 0) && (
                <div className="flex gap-3 mb-2 text-[11px]">
                  {pointsDiscount > 0 && <span className="text-emerald-400">💰 Poin: -{formatCurrency(pointsDiscount)}</span>}
                  {promoDiscount > 0 && selectedPromo && <span className="text-amber-400">🏷️ {selectedPromo.name}: -{formatCurrency(promoDiscount)}</span>}
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-zinc-500 leading-tight">Total</p>
                  <p className="text-xl font-black text-zinc-100 leading-tight">{formatCurrency(total)}</p>
                </div>
                <Button onClick={openCheckoutDialog}
                  className="h-12 px-8 font-bold text-sm rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] shrink-0">
                  Bayar <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Mobile Checkout Sheet (Payment Flow) ── */}
      {isMobile ? (
        <Sheet open={checkoutOpen} onOpenChange={(open) => { if (!open) setCheckoutOpen(false) }}>
          <SheetContent side="bottom" className="bg-zinc-950 border-zinc-800 rounded-t-3xl h-[92vh] max-h-[92vh] overflow-hidden flex flex-col px-0 gap-0">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-zinc-700" />
            </div>
            <SheetHeader className="px-5 pb-3 shrink-0">
              <SheetTitle className="text-zinc-100 text-base font-bold flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Banknote className="h-4 w-4 text-emerald-400" />
                </div>
                Pembayaran
                <span className="ml-auto text-[11px] font-medium text-zinc-500 bg-zinc-800 px-2.5 py-0.5 rounded-full">{cart.reduce((s, i) => s + i.qty, 0)} item</span>
              </SheetTitle>
            </SheetHeader>

            {/* Scrollable content */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 space-y-4 pb-2">
              {/* Order summary */}
              <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl p-3.5">
                <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wide mb-2">Ringkasan Pesanan</p>
                <div className="space-y-1.5 text-xs">
                  {cart.map((item) => (
                    <div key={item.product.id} className="flex justify-between text-zinc-300">
                      <span className="truncate mr-2">{item.product.name} <span className="text-zinc-500">×{item.qty}</span></span>
                      <span className="font-medium shrink-0">{formatCurrency(item.product.price * item.qty)}</span>
                    </div>
                  ))}
                  <Separator className="bg-zinc-800 !my-2" />
                  <div className="flex justify-between text-zinc-400"><span>Subtotal</span><span className="text-zinc-200">{formatCurrency(subtotal)}</span></div>
                  {settings.loyaltyEnabled && selectedCustomer && maxPointsToUse > 0 && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-zinc-400 flex items-center gap-1 shrink-0"><Coins className="h-3 w-3" /> Pakai Poin</span>
                      <Input type="number" min="0" max={maxPointsToUse} value={pointsToUse || ''} onChange={(e) => handlePointsChange(e.target.value)}
                        placeholder="0" className="w-24 h-8 text-right text-xs bg-zinc-800 border-zinc-700 text-zinc-100 rounded-lg" />
                    </div>
                  )}
                  {pointsDiscount > 0 && <div className="flex justify-between text-emerald-400"><span>Diskon Poin</span><span>-{formatCurrency(pointsDiscount)}</span></div>}
                  {promoDiscount > 0 && selectedPromo && (
                    <div className="flex justify-between text-amber-400">
                      <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> {selectedPromo.name}</span>
                      <span>-{formatCurrency(promoDiscount)}</span>
                    </div>
                  )}
                  <Separator className="bg-zinc-800 !my-2" />
                  <div className="flex justify-between text-base font-black text-zinc-100"><span>Total</span><span>{formatCurrency(total)}</span></div>
                </div>
                {selectedCustomer && (
                  <div className="mt-2 pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-500">
                    👤 {selectedCustomer.name}
                  </div>
                )}
              </div>

              {/* Payment method */}
              <div>
                <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wide mb-2">Metode Pembayaran</p>
                {renderPaymentButtons(false)}
              </div>

              {/* Cash payment section */}
              {paymentMethod === 'CASH' && (
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] text-zinc-500 font-medium mb-1.5">Jumlah Bayar</p>
                    <Input type="number" min="0" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="Masukkan jumlah"
                      className="h-12 text-base bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 rounded-xl text-right font-bold" />
                  </div>
                  {Number(paidAmount) >= total && total > 0 && (
                    <div className="flex justify-between items-center text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                      <span className="text-emerald-400 font-medium">Kembalian</span>
                      <span className="text-emerald-400 font-black text-lg">{formatCurrency(change)}</span>
                    </div>
                  )}
                  <div>
                    <p className="text-[11px] text-zinc-500 font-medium mb-2">Nominal Cepat</p>
                    <div className="grid grid-cols-3 gap-2">
                      {getQuickNominals.map((nom) => (
                        <button key={nom} onClick={() => setPaidAmount(String(nom))}
                          className={cn(
                            'py-3 rounded-xl text-sm font-bold border transition-all active:scale-95',
                            Number(paidAmount) === nom
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-sm'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700 active:bg-zinc-800'
                          )}>
                          {nom >= 1000 ? `${(nom / 1000)}K` : nom}
                        </button>
                      ))}
                      {total > 0 && (
                        <button onClick={() => setPaidAmount(String(Math.ceil(total / 1000) * 1000))}
                          className="py-3 rounded-xl text-sm font-bold border bg-zinc-900 border-zinc-800 text-amber-400 hover:border-amber-500/30 transition-all active:scale-95">
                          Uang Pas
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Non-cash info */}
              {paymentMethod !== 'CASH' && (
                <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl p-4 text-center">
                  <p className="text-xs text-zinc-400">Pembayaran <span className="font-bold text-zinc-200 uppercase">{paymentMethod}</span></p>
                  <p className="text-2xl font-black text-zinc-100 mt-1">{formatCurrency(total)}</p>
                </div>
              )}
            </div>

            {/* Sticky confirm footer */}
            <SheetFooter className="shrink-0 flex-row gap-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] px-5 border-t border-zinc-800">
              <Button variant="ghost" onClick={() => setCheckoutOpen(false)}
                className="flex-1 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 text-sm font-medium rounded-2xl h-12">
                Kembali
              </Button>
              <Button onClick={handleCheckout}
                disabled={checkingOut || (paymentMethod === 'CASH' && Number(paidAmount) < total)}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold h-12 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]">
                {checkingOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {checkingOut ? 'Memproses...' : `Konfirmasi ${formatCurrency(total)}`}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={checkoutOpen} onOpenChange={(open) => { if (!open) setCheckoutOpen(false) }}>
          <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md rounded-2xl">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-zinc-100 text-sm font-bold">Konfirmasi Pembayaran</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-1">
              <div className="space-y-1 text-xs">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex justify-between text-zinc-300 py-0.5">
                    <span>{item.product.name} × {item.qty}</span>
                    <span className="font-medium">{formatCurrency(item.product.price * item.qty)}</span>
                  </div>
                ))}
                <Separator className="bg-zinc-800 my-1.5" />
                <div className="flex justify-between text-zinc-400"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                {pointsDiscount > 0 && <div className="flex justify-between text-emerald-400"><span>Diskon Poin</span><span>-{formatCurrency(pointsDiscount)}</span></div>}
                {promoDiscount > 0 && selectedPromo && (
                  <div className="flex justify-between text-amber-400 text-xs">
                    <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> Promo: {selectedPromo.name}</span>
                    <span>-{formatCurrency(promoDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-zinc-100 pt-0.5"><span>Total</span><span>{formatCurrency(total)}</span></div>
              </div>

              <Separator className="bg-zinc-800" />

              <div className="text-xs space-y-1">
                <div className="flex justify-between text-zinc-400"><span>Metode</span><span className="text-zinc-200 font-medium uppercase">{paymentMethod}</span></div>
                {paymentMethod === 'CASH' && (
                  <>
                    <div className="flex justify-between text-zinc-400"><span>Dibayar</span><span className="text-zinc-200">{formatCurrency(Number(paidAmount))}</span></div>
                    <div className="flex justify-between text-emerald-400 font-bold"><span>Kembalian</span><span>{formatCurrency(change)}</span></div>
                  </>
                )}
                {(paymentMethod === 'QRIS' || paymentMethod === 'DEBIT') && (
                  <div className="flex justify-between text-zinc-400"><span>Dibayar</span><span className="text-zinc-200">{formatCurrency(total)}</span></div>
                )}
              </div>

              <p className="text-[11px] text-zinc-500">Customer: {selectedCustomer ? selectedCustomer.name : 'Walk-in'}</p>
            </div>
            <DialogFooter className="gap-2 pt-1">
              <Button variant="ghost" onClick={() => setCheckoutOpen(false)} className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 text-xs rounded-xl">Batal</Button>
              <Button onClick={handleCheckout} disabled={checkingOut || (paymentMethod === 'CASH' && Number(paidAmount) < total)}
                className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs rounded-xl font-bold">
                {checkingOut && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />} Konfirmasi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={(open) => { if (!open) handleReceiptSkip() }}>
        <DialogContent className="bg-white border-zinc-200 max-w-md p-0 overflow-hidden rounded-2xl">
          {checkoutResult && (
            <>
              <DialogHeader className="sr-only"><DialogTitle>Struk - {checkoutResult.invoiceNumber}</DialogTitle></DialogHeader>
              <ScrollArea className="max-h-[80vh]">
                <div className="p-5">
                  {/* Status badge */}
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isOfflineReceipt ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                      {isOfflineReceipt ? <CloudOff className="h-4 w-4 text-amber-600" /> : <Check className="h-4 w-4 text-emerald-600" />}
                    </div>
                    <div className="text-left">
                      <p className={`text-xs font-bold ${isOfflineReceipt ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {isOfflineReceipt ? 'Tersimpan Offline' : 'Pembayaran Berhasil'}
                      </p>
                      <p className="text-[10px] text-zinc-500">{checkoutResult.invoiceNumber}</p>
                    </div>
                  </div>

                  {/* Sync error warning */}
                  {checkoutResult.syncError && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 mb-3">
                      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] text-amber-700 font-medium">Gagal sync ke server</p>
                        <p className="text-[10px] text-amber-600">{checkoutResult.syncError}</p>
                      </div>
                    </div>
                  )}

                  {/* Receipt content — thermal preview */}
                  <div className="bg-white border border-zinc-200 rounded-lg shadow-inner mx-auto max-w-[300px]">
                    <div className="font-mono text-xs" style={{ fontWeight: 600 }}>
                      {renderReceiptContent()}
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter className="flex gap-2 p-3 border-t border-zinc-200 bg-zinc-50 rounded-b-2xl">
                <Button onClick={handleReceiptPrint} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl h-10">
                  <ReceiptText className="mr-1.5 h-4 w-4" /> Cetak Struk
                </Button>
                <Button variant="outline" onClick={handleReceiptSkip} className="flex-1 border-zinc-300 text-zinc-600 hover:bg-zinc-100 text-sm rounded-xl h-10">
                  Selesai
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Customer Dialog */}
      <ResponsiveDialog open={addCustomerOpen} onOpenChange={setAddCustomerOpen}>
        <ResponsiveDialogContent desktopClassName="max-w-sm rounded-2xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-emerald-400" /> Tambah Customer Baru
            </ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300">Nama *</Label>
              <Input value={newCustomer.name} onChange={(e) => setNewCustomer(p => ({ ...p, name: e.target.value }))}
                placeholder="Nama customer" className="h-9 text-sm bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300">No. WhatsApp *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500 font-medium">+62</span>
                <Input value={newCustomer.whatsapp} onChange={(e) => setNewCustomer(p => ({ ...p, whatsapp: e.target.value.replace(/[^0-9]/g, '') }))}
                  placeholder="81234567890" className="h-9 text-sm bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 rounded-lg pl-12" />
              </div>
              <p className="text-[10px] text-zinc-600">Format: 81234567890 (tanpa 0 di depan). WhatsApp digunakan sebagai ID unik.</p>
            </div>
          </div>
          <ResponsiveDialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setAddCustomerOpen(false)} className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 text-xs rounded-xl">Batal</Button>
            <Button onClick={handleAddCustomer} disabled={addingCustomer || !newCustomer.name.trim() || !newCustomer.whatsapp.trim()}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs rounded-xl font-medium">
              {addingCustomer && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />} Simpan
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  )
}
