'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { formatCurrency, formatNumber } from '@/lib/format'
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
  Coins,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  ScanBarcode,
  Wifi,
  WifiOff,
  RefreshCw,
  CloudOff,
  Database,
  ArrowDownToLine,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { localDB, type OfflineTransaction, type CachedProduct, type CachedCustomer } from '@/lib/local-db'
import { syncAllData, getAllSyncTimes } from '@/lib/sync-service'

interface Product {
  id: string
  name: string
  price: number
  stock: number
  sku: string | null
  barcode: string | null
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
}

interface ReceiptSettings {
  receiptBusinessName: string
  receiptAddress: string
  receiptPhone: string
  receiptFooter: string
  themePrimaryColor: string
}

const PRODUCTS_PER_PAGE = 20

export default function PosPage() {
  const { data: session } = useSession()

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncingRef = useRef(false)

  // Products
  const [products, setProducts] = useState<Product[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [productsLoading, setProductsLoading] = useState(true)
  const [productPage, setProductPage] = useState(1)
  const [totalProductPages, setTotalProductPages] = useState(1)

  // Settings
  const [settings, setSettings] = useState<ReceiptSettings>({
    receiptBusinessName: 'Aether POS',
    receiptAddress: '',
    receiptPhone: '',
    receiptFooter: 'Terima kasih atas kunjungan Anda!',
    themePrimaryColor: 'emerald',
  })

  // Fetch receipt settings from server
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data = await res.json()
          setSettings({
            receiptBusinessName: data.receiptBusinessName || 'Aether POS',
            receiptAddress: data.receiptAddress || '',
            receiptPhone: data.receiptPhone || '',
            receiptFooter: data.receiptFooter || 'Terima kasih atas kunjungan Anda!',
            themePrimaryColor: data.themePrimaryColor || 'emerald',
          })
          // Also update available payment methods from settings
          if (data.paymentMethods) {
            const methods = data.paymentMethods.split(',').map((m: string) => m.trim().toUpperCase())
            if (methods.length > 0 && !methods.includes(paymentMethod)) {
              setPaymentMethod(methods[0] as 'CASH' | 'QRIS' | 'DEBIT')
            }
          }
        }
      } catch {
        // Use defaults
      }
    }
    fetchSettings()
  }, [])  

  // Customers
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)

  // Cart
  const [cart, setCart] = useState<CartItem[]>([])
  const [pointsToUse, setPointsToUse] = useState(0)

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS' | 'DEBIT'>('CASH')
  const [paidAmount, setPaidAmount] = useState('')

  // Checkout
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)

  // Offline / Online state
  const [isOnline, setIsOnline] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [dataSyncing, setDataSyncing] = useState(false)
  const [lastSyncTimes, setLastSyncTimes] = useState<{ products: number | null; customers: number | null; promos: number | null }>({ products: null, customers: null, promos: null })
  const initialSyncDone = useRef(false)

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

  // Live query for unsynced transactions count
  const unsyncedCount = useLiveQuery(
    () => localDB.transactions.where('isSynced').equals(0).count(),
    []
  ) ?? 0

  // Live query for unsynced transactions list (for display)
  const unsyncedTransactions = useLiveQuery(
    () => localDB.transactions.where('isSynced').equals(0).toArray(),
    []
  ) ?? []

  // Auto-sync transactions + re-download master data when coming back online
  // (only after initial sync has completed, to avoid duplicate)
  useEffect(() => {
    if (isOnline && initialSyncDone.current && !syncingRef.current) {
      syncingRef.current = true
      const timer = setTimeout(async () => {
        try {
          // 1. Sync pending transactions
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

          // 2. Re-download master data (products, customers, promos)
          setDataSyncing(true)
          const result = await syncAllData()
          fetchProducts(productSearch, productPage)
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

  // Auto-sync master data on mount (if online & not yet synced)
  useEffect(() => {
    if (isOnline && !initialSyncDone.current) {
      initialSyncDone.current = true
      const doInitialSync = async () => {
        setDataSyncing(true)
        try {
          const result = await syncAllData()
          // Reload products & customers from IndexedDB after sync
          fetchProducts(productSearch, productPage)
          loadCustomersFromCache()
          // Update sync timestamps for UI
          const times = await getAllSyncTimes()
          setLastSyncTimes(times)
          if (result.products.count > 0 || result.customers.count > 0) {
            toast.success(`Data synced: ${result.products.count} produk, ${result.customers.count} customer, ${result.promos.count} promo`)
          }
        } catch {
          // If sync fails, still try to load from cache
          fetchProducts(productSearch, productPage)
          loadCustomersFromCache()
        } finally {
          setDataSyncing(false)
        }
      }
      doInitialSync()
    } else if (!isOnline && !initialSyncDone.current) {
      // Offline on first load — just use cached data
      initialSyncDone.current = true
      fetchProducts(productSearch, productPage)
      const loadSyncTimes = async () => {
        const times = await getAllSyncTimes()
        setLastSyncTimes(times)
      }
      loadSyncTimes()
    }
  }, [isOnline])  

  // Auto-focus search input on mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [])

  // Fetch products from IndexedDB (offline-first — super fast, no API call)
  const fetchProducts = useCallback(async (search: string, page: number) => {
    setProductsLoading(true)
    try {
      const allProducts = await localDB.products.toArray()

      // Client-side search/filter
      let filtered = allProducts
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        filtered = allProducts.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.sku && p.sku.toLowerCase().includes(q)) ||
            (p.barcode && p.barcode.toLowerCase().includes(q))
        )
      }

      // Client-side pagination
      const totalPages = Math.max(1, Math.ceil(filtered.length / PRODUCTS_PER_PAGE))
      const skip = (page - 1) * PRODUCTS_PER_PAGE
      const paged = filtered.slice(skip, skip + PRODUCTS_PER_PAGE)

      setProducts(paged)
      setTotalProductPages(totalPages)
    } catch {
      toast.error('Failed to load products from local storage')
    } finally {
      setProductsLoading(false)
    }
  }, [])

  // Debounced product fetch on search or page change
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    const timer = setTimeout(() => {
      fetchProducts(productSearch, productPage)
    }, productSearch ? 300 : 0)
    debounceTimerRef.current = timer
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [productSearch, productPage, fetchProducts])

  // Load customers from IndexedDB (offline-first)
  const loadCustomersFromCache = useCallback(async () => {
    try {
      const cached = await localDB.customers.toArray()
      setCustomers(cached as unknown as Customer[])
    } catch {
      // silent — will retry on next sync
    }
  }, [])

  // Load customers from IndexedDB on mount
  useEffect(() => {
    loadCustomersFromCache()
  }, [loadCustomersFromCache])

  // Handle search change — reset to page 1
  const handleSearchChange = (value: string) => {
    setProductSearch(value)
    setProductPage(1)
  }

  // Handle Enter key on search — barcode scan behavior
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && productSearch.trim()) {
      // If exactly one product matches, auto-add to cart
      if (products.length === 1 && !productsLoading) {
        const product = products[0]
        if (product.stock > 0) {
          addToCart(product)
          setProductSearch('')
          toast.success(`${product.name} added to cart`)
        }
      }
    }
  }

  // Filter customers for dropdown
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers.slice(0, 20)
    const q = customerSearch.toLowerCase()
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.whatsapp.includes(q)
    )
  }, [customers, customerSearch])

  // Cart calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.price * item.qty, 0)
  }, [cart])

  const maxPointsToUse = selectedCustomer ? selectedCustomer.points : 0
  const pointsDiscount = pointsToUse * 100 // 100 IDR per point
  const total = Math.max(0, subtotal - pointsDiscount)
  const change = paymentMethod === 'CASH' ? Math.max(0, Number(paidAmount) - total) : 0

  // Cart actions
  const addToCart = (product: Product) => {
    if (product.stock <= 0) return
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id)
      if (existing) {
        if (existing.qty >= product.stock) {
          toast.warning('Not enough stock')
          return prev
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item
        )
      }
      return [...prev, { product, qty: 1 }]
    })
  }

  const updateQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId)
      return
    }
    const item = cart.find((i) => i.product.id === productId)
    if (item && newQty > item.product.stock) {
      toast.warning('Not enough stock')
      return
    }
    setCart((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, qty: newQty } : i))
    )
  }

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId))
  }

  const clearCart = () => {
    setCart([])
    setPointsToUse(0)
    setPaidAmount('')
    setPaymentMethod('CASH')
    setSelectedCustomer(null)
    setCheckoutResult(null)
  }

  // Handle points change
  const handlePointsChange = (value: string) => {
    const num = Math.min(Number(value) || 0, maxPointsToUse)
    setPointsToUse(num)
  }

  // Handle checkout (offline-first)
  const handleCheckout = async () => {
    if (cart.length === 0) return
    if (paymentMethod === 'CASH' && Number(paidAmount) < total) {
      toast.error('Paid amount is less than total')
      return
    }
    setCheckingOut(true)
    try {
      // Build the checkout payload
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
        discount: pointsDiscount,
        pointsUsed: pointsToUse,
        total,
        paymentMethod,
        paidAmount: paymentMethod === 'CASH' ? Number(paidAmount) : total,
        change: paymentMethod === 'CASH' ? change : 0,
      }

      // STEP 1: ALWAYS save to IndexedDB first (single source of truth)
      const localId = await localDB.transactions.add({
        payload: checkoutPayload,
        isSynced: 0, // pending
        createdAt: Date.now(),
        retryCount: 0,
      })

      // STEP 2: If online, try to sync to server immediately
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
              // Mark as synced in IndexedDB
              await localDB.transactions.update(localId, {
                isSynced: 1,
                syncedAt: Date.now(),
                invoiceNumber: syncData.results?.[0]?.invoiceNumber,
                serverTransactionId: syncData.results?.[0]?.serverId,
              })

              // Generate local invoice for receipt if server didn't provide one
              const invoiceNum = syncData.results?.[0]?.invoiceNumber || `OFF-${Date.now().toString(36).toUpperCase()}`
              setCheckoutResult({ success: true, invoiceNumber: invoiceNum })
              toast.success(`Sale completed! Invoice: ${invoiceNum}`)
              setCheckoutOpen(false)
              setReceiptOpen(true)
              fetchProducts(productSearch, productPage)
              fetchCustomersData()
            } else {
              // Server accepted but 0 synced — leave as pending
              const error = syncData.results?.[0]?.error || 'Pending sync'
              const invoiceNum = `OFF-${Date.now().toString(36).toUpperCase()}`
              setCheckoutResult({ success: true, invoiceNumber: invoiceNum, message: `Saved offline. ${error}` })
              toast.warning(`Saved locally. Will sync when connection available.`, { description: error })
              setCheckoutOpen(false)
              setReceiptOpen(true)
              // Still clear cart even if offline
            }
          }
        } catch (syncErr) {
          // Network error during sync — save locally, mark pending
          console.error('Immediate sync failed, saved locally:', syncErr)
          const invoiceNum = `OFF-${Date.now().toString(36).toUpperCase()}`
          setCheckoutResult({ success: true, invoiceNumber: invoiceNum, message: 'Saved offline — will sync later' })
          toast.warning('Saved offline — will sync when connection is restored')
          setCheckoutOpen(false)
          setReceiptOpen(true)
        }
      } else {
        // OFFLINE: Save locally, show receipt
        const invoiceNum = `OFF-${Date.now().toString(36).toUpperCase()}`
        setCheckoutResult({ success: true, invoiceNumber: invoiceNum, message: 'Offline transaction' })
        toast.warning('No internet — transaction saved locally', {
          description: 'It will sync automatically when you are back online.',
          duration: 5000,
        })
        setCheckoutOpen(false)
        setReceiptOpen(true)
      }

      // Note: cart is cleared when user skips/prints receipt
    } catch {
      toast.error('Checkout failed — could not save transaction')
    } finally {
      setCheckingOut(false)
    }
  }

  const fetchCustomersData = async () => {
    // Refresh customer data from IndexedDB after sync
    await loadCustomersFromCache()
  }

  const openCheckoutDialog = () => {
    if (cart.length === 0) return
    setCheckoutResult(null)
    setCheckoutOpen(true)
  }

  // Handle receipt skip
  const handleReceiptSkip = () => {
    setReceiptOpen(false)
    clearCart()
  }

  // Handle receipt print
  const handleReceiptPrint = () => {
    window.print()
    setReceiptOpen(false)
    clearCart()
  }

  // Handle bulk sync of all offline transactions
  const handleSync = async () => {
    if (syncing || unsyncedCount === 0) return
    setSyncing(true)
    try {
      const pending = await localDB.transactions.where('isSynced').equals(0).toArray()
      if (pending.length === 0) {
        toast.info('No pending transactions')
        return
      }

      const res = await fetch('/api/transactions/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: pending }),
      })
      const data = await res.json()

      if (res.ok) {
        // Mark synced transactions
        for (const result of data.results || []) {
          if (result.success) {
            await localDB.transactions.update(result.localId, {
              isSynced: 1,
              syncedAt: Date.now(),
              invoiceNumber: result.invoiceNumber,
              serverTransactionId: result.serverId,
            })
          } else {
            // Increment retry count for failed ones
            await localDB.transactions.update(result.localId, {
              retryCount: (await localDB.transactions.get(result.localId))?.retryCount
                ? ((await localDB.transactions.get(result.localId))!.retryCount + 1)
                : 1,
              lastError: result.error,
            })
          }
        }

        if (data.synced > 0) {
          toast.success(`${data.synced} transaction(s) synced successfully!`)
          fetchProducts(productSearch, productPage)
          fetchCustomersData()
        }
        if (data.failed > 0) {
          toast.error(`${data.failed} transaction(s) failed to sync`, {
            description: 'Check if products have sufficient stock.',
          })
        }
      } else {
        toast.error('Sync failed — server error')
      }
    } catch (err) {
      console.error('Sync error:', err)
      toast.error('Sync failed — no internet connection')
    } finally {
      setSyncing(false)
    }
  }

  // Format date/time for receipt
  const formatReceiptDateTime = () => {
    const now = new Date()
    const date = now.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    const time = now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    return `${date} ${time}`
  }

  // Payment method icon helper
  const getPaymentIcon = () => {
    switch (paymentMethod) {
      case 'QRIS': return <QrCode className="h-4 w-4" />
      case 'DEBIT': return <CreditCard className="h-4 w-4" />
      default: return <Banknote className="h-4 w-4" />
    }
  }

  const getPaymentLabel = () => {
    switch (paymentMethod) {
      case 'QRIS': return 'QRIS'
      case 'DEBIT': return 'DEBIT'
      default: return 'CASH'
    }
  }

  // Receipt content renderer
  const renderReceipt = () => {
    if (!checkoutResult) return null
    return (
      <div id="receipt-print" className="bg-white text-zinc-900 font-mono text-xs">
        {/* Receipt Header */}
        <div className="text-center space-y-1 pb-3">
          <p className="text-base font-bold">{settings.receiptBusinessName}</p>
          {settings.receiptAddress && <p className="text-[11px] text-zinc-500">{settings.receiptAddress}</p>}
          {settings.receiptPhone && <p className="text-[11px] text-zinc-500">{settings.receiptPhone}</p>}
        </div>

        {/* Separator */}
        <div className="border-t border-dashed border-zinc-300 my-2" />

        {/* Invoice Info */}
        <div className="space-y-0.5 py-2">
          <div className="flex justify-between">
            <span className="text-zinc-500">Invoice</span>
            <span className="font-semibold">{checkoutResult.invoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Date</span>
            <span>{formatReceiptDateTime()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Customer</span>
            <span>{selectedCustomer ? selectedCustomer.name : 'Walk-in'}</span>
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-dashed border-zinc-300 my-2" />

        {/* Items */}
        <div className="space-y-1.5 py-2">
          {cart.map((item) => (
            <div key={item.product.id} className="space-y-0.5">
              <p className="font-medium text-[11px]">{item.product.name}</p>
              <div className="flex justify-between text-[11px] text-zinc-600">
                <span>{item.qty} x {formatCurrency(item.product.price)}</span>
                <span className="font-medium text-zinc-900">{formatCurrency(item.product.price * item.qty)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Separator */}
        <div className="border-t border-dashed border-zinc-300 my-2" />

        {/* Totals */}
        <div className="space-y-0.5 py-2">
          <div className="flex justify-between">
            <span className="text-zinc-500">Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {pointsDiscount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Points Discount</span>
              <span>-{formatCurrency(pointsDiscount)}</span>
            </div>
          )}
          <div className="border-t border-dashed border-zinc-300 my-2" />
          <div className="flex justify-between text-sm font-bold">
            <span>TOTAL</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-dashed border-zinc-300 my-2" />

        {/* Payment Info */}
        <div className="space-y-0.5 py-2">
          <div className="flex justify-between">
            <span className="text-zinc-500">Payment</span>
            <span className="font-semibold uppercase">{paymentMethod}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Paid</span>
            <span>{formatCurrency(paymentMethod === 'CASH' ? Number(paidAmount) : total)}</span>
          </div>
          {paymentMethod === 'CASH' && change > 0 && (
            <div className="flex justify-between font-semibold">
              <span>Change</span>
              <span>{formatCurrency(change)}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        {settings.receiptFooter && (
          <>
            <div className="border-t border-dashed border-zinc-300 my-2" />
            <div className="text-center py-2">
              <p className="text-[11px] text-zinc-400">{settings.receiptFooter}</p>
            </div>
          </>
        )}
      </div>
    )
  }

  // Pagination Controls
  const renderPagination = () => {
    if (totalProductPages <= 1 && !productSearch) return null
    return (
      <div className="flex items-center justify-between px-2 py-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setProductPage((p) => Math.max(1, p - 1))}
          disabled={productPage <= 1 || productsLoading}
          className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 h-7 text-xs"
        >
          <ChevronLeft className="h-3 w-3 mr-1" />
          Prev
        </Button>
        <span className="text-[11px] text-zinc-400 font-medium">
          {productPage}/{totalProductPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setProductPage((p) => Math.min(totalProductPages, p + 1))}
          disabled={productPage >= totalProductPages || productsLoading}
          className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 h-7 text-xs"
        >
          Next
          <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    )
  }

  // Product grid content
  const renderProductGrid = (mobile = false) => {
    if (productsLoading) {
      return Array.from({ length: mobile ? 6 : 8 }).map((_, i) => (
        <div key={i} className={`${mobile ? 'h-24' : 'h-24'} rounded-lg bg-zinc-800/30`} />
      ))
    }

    if (products.length === 0) {
      return (
        <div className="col-span-full text-center py-8">
          <Package className="h-8 w-8 text-zinc-600 mx-auto mb-1.5" />
          <p className="text-xs text-zinc-500">No products found</p>
        </div>
      )
    }

    return products.map((product) => {
      const cartItem = cart.find((i) => i.product.id === product.id)
      const outOfStock = product.stock <= 0
      return (
        <button
          key={product.id}
          onClick={() => !outOfStock && addToCart(product)}
          disabled={outOfStock}
          className={`relative p-2.5 rounded-lg border text-left ${
            outOfStock
              ? 'opacity-40 cursor-not-allowed border-zinc-800 bg-zinc-900'
              : cartItem
              ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50'
              : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800/80'
          }`}
        >
          {cartItem && (
            <div className={`absolute -top-1.5 -right-1.5 ${mobile ? 'w-4.5 h-4.5 text-[9px]' : 'w-5 h-5 text-[10px]'} rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center`}>
              {cartItem.qty}
            </div>
          )}
          <p className="text-xs font-medium text-zinc-200 truncate mb-0.5">{product.name}</p>
          <p className="text-xs text-emerald-400 font-semibold">{formatCurrency(product.price)}</p>
          <p className={`text-[10px] mt-0.5 ${outOfStock ? 'text-red-400' : 'text-zinc-500'}`}>
            Stock: {product.stock}
          </p>
        </button>
      )
    })
  }

  // Search input component
  const renderSearchInput = () => (
    <div className="relative mb-3">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
      <ScanBarcode className="absolute left-8 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-600" />
      <Input
        ref={searchInputRef}
        placeholder="Scan barcode or search product..."
        value={productSearch}
        onChange={(e) => handleSearchChange(e.target.value)}
        onKeyDown={handleSearchKeyDown}
        className="pl-11 h-9 text-sm bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
      />
    </div>
  )

  // Payment method buttons
  const renderPaymentButtons = (compact = false) => (
    <div className="flex gap-2">
      <Button
        variant={paymentMethod === 'CASH' ? 'default' : 'outline'}
        onClick={() => setPaymentMethod('CASH')}
        className={`flex-1 ${compact ? 'h-8 text-xs' : 'h-9 text-xs'} ${
          paymentMethod === 'CASH'
            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
        }`}
      >
        <Banknote className={`${compact ? 'mr-1 h-3 w-3' : 'mr-1.5 h-3.5 w-3.5'}`} />
        CASH
      </Button>
      <Button
        variant={paymentMethod === 'QRIS' ? 'default' : 'outline'}
        onClick={() => setPaymentMethod('QRIS')}
        className={`flex-1 ${compact ? 'h-8 text-xs' : 'h-9 text-xs'} ${
          paymentMethod === 'QRIS'
            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
        }`}
      >
        <QrCode className={`${compact ? 'mr-1 h-3 w-3' : 'mr-1.5 h-3.5 w-3.5'}`} />
        QRIS
      </Button>
      <Button
        variant={paymentMethod === 'DEBIT' ? 'default' : 'outline'}
        onClick={() => setPaymentMethod('DEBIT')}
        className={`flex-1 ${compact ? 'h-8 text-xs' : 'h-9 text-xs'} ${
          paymentMethod === 'DEBIT'
            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
        }`}
      >
        <CreditCard className={`${compact ? 'mr-1 h-3 w-3' : 'mr-1.5 h-3.5 w-3.5'}`} />
        DEBIT
      </Button>
    </div>
  )

  // Customer selector component
  const renderCustomerSelector = (isMobile = false) => (
    <div className={isMobile ? 'bg-zinc-900 border border-zinc-800 rounded-lg p-3' : 'border-b border-zinc-800 px-3 py-2.5'}>
      <Label className="text-[11px] text-zinc-500 mb-1 block">Customer</Label>
      <div className="relative">
        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
        <Input
          placeholder={selectedCustomer ? selectedCustomer.name : 'Search customer (walk-in if empty)'}
          value={customerSearch}
          onChange={(e) => {
            setCustomerSearch(e.target.value)
            setCustomerDropdownOpen(true)
          }}
          onFocus={() => setCustomerDropdownOpen(true)}
          className="pl-9 h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
        />
        {selectedCustomer && (
          <button
            onClick={() => {
              setSelectedCustomer(null)
              setCustomerSearch('')
              setPointsToUse(0)
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {customerDropdownOpen && filteredCustomers.length > 0 && !selectedCustomer && (
        <div className={`absolute z-20 ${isMobile ? 'w-[calc(100%-1.5rem)]' : 'w-full'} mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl max-h-40 overflow-y-auto`}>
          {filteredCustomers.map((customer) => (
            <button
              key={customer.id}
              onClick={() => {
                setSelectedCustomer(customer)
                setCustomerSearch('')
                setCustomerDropdownOpen(false)
                setPointsToUse(0)
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-zinc-700 border-b border-zinc-700/50 last:border-0"
            >
              <p className="text-xs text-zinc-200">{customer.name}</p>
              <p className="text-[10px] text-zinc-500">{customer.whatsapp} · {customer.points} pts</p>
            </button>
          ))}
        </div>
      )}
      {selectedCustomer && !isMobile && (
        <div className="mt-1.5 flex items-center gap-2">
          <Badge className="bg-amber-500/10 border-amber-500/20 text-amber-400 text-[10px]">
            <Coins className="mr-1 h-2.5 w-2.5" />
            {selectedCustomer.points} points available
          </Badge>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Point of Sale</h1>
        <p className="text-xs text-zinc-500">Process sales and accept payments</p>
      </div>

      {/* Offline/Online Status Bar */}
      <div className="flex items-center justify-between flex-wrap gap-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Connection status */}
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium ${
            isOnline
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            {isOnline ? (
              <><Wifi className="h-3 w-3" /><span>Online</span></>
            ) : (
              <><WifiOff className="h-3 w-3" /><span>Offline</span></>
            )}
          </div>

          {/* Data sync status */}
          {lastSyncTimes.products ? (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium ${
              dataSyncing
                ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                : 'bg-zinc-800 border border-zinc-700 text-zinc-500'
            }`}>
              {dataSyncing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Database className="h-3 w-3" />
              )}
              <span>
                {dataSyncing ? 'Syncing...' : 'Cached'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-medium">
              <Database className="h-3 w-3" />
              <span>No cache</span>
            </div>
          )}

          {/* Unsynced transactions — static amber badge, no animate-pulse */}
          {unsyncedCount > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-medium">
              <CloudOff className="h-3 w-3" />
              <span>{unsyncedCount} pending</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Refresh data button */}
          <Button
            onClick={async () => {
              if (dataSyncing || !isOnline) return
              setDataSyncing(true)
              try {
                const result = await syncAllData()
                fetchProducts(productSearch, productPage)
                loadCustomersFromCache()
                const times = await getAllSyncTimes()
                setLastSyncTimes(times)
                toast.success(`Data refreshed: ${result.products.count} produk, ${result.customers.count} customer`)
              } catch {
                toast.error('Gagal refresh data')
              } finally {
                setDataSyncing(false)
              }
            }}
            disabled={dataSyncing || !isOnline}
            variant="outline"
            size="sm"
            className="bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-50 h-7 text-xs gap-1.5"
            title="Refresh data dari server"
          >
            {dataSyncing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ArrowDownToLine className="h-3 w-3" />
            )}
            Refresh
          </Button>

          {/* Sync transactions button */}
          {unsyncedCount > 0 && (
            <Button
              onClick={handleSync}
              disabled={syncing || !isOnline}
              variant="outline"
              size="sm"
              className="bg-amber-600/20 border-amber-500/30 text-amber-400 hover:bg-amber-600/30 hover:text-amber-300 disabled:opacity-50 disabled:animate-none h-7 text-xs gap-1.5"
            >
              {syncing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Sync {unsyncedCount}
            </Button>
          )}
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden md:grid md:grid-cols-5 gap-4 min-h-[calc(100vh-10rem)]">
        {/* Products - Left */}
        <div className="md:col-span-3 flex flex-col">
          {renderSearchInput()}
          <ScrollArea className="flex-1">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 pb-3">
              {renderProductGrid(false)}
            </div>
          </ScrollArea>
          {renderPagination()}
        </div>

        {/* Cart - Right */}
        <div className="md:col-span-2 flex flex-col bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="py-3 px-3 border-b border-zinc-800">
            <h2 className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <ShoppingCart className="h-3.5 w-3.5 text-emerald-400" />
              Cart ({cart.length} items)
            </h2>
          </div>

          {/* Customer Selector */}
          {renderCustomerSelector(false)}

          {/* Cart Items */}
          <ScrollArea className="flex-1 p-3">
            {cart.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-8 w-8 text-zinc-600 mx-auto mb-1.5" />
                <p className="text-zinc-500 text-xs">Cart is empty</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-zinc-800/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-zinc-200 truncate">{item.product.name}</p>
                      <p className="text-[11px] text-zinc-400">{formatCurrency(item.product.price)} × {item.qty}</p>
                      <p className="text-xs text-emerald-400 font-semibold mt-0.5">
                        {formatCurrency(item.product.price * item.qty)}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700"
                        onClick={() => updateQty(item.product.id, item.qty - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-xs text-zinc-200 w-5 text-center font-medium">{item.qty}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700"
                        onClick={() => updateQty(item.product.id, item.qty + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 ml-0.5"
                        onClick={() => removeFromCart(item.product.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Summary & Payment */}
          <div className="border-t border-zinc-800 p-3 space-y-2.5">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal</span>
                <span className="text-zinc-200">{formatCurrency(subtotal)}</span>
              </div>
              {selectedCustomer && maxPointsToUse > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 flex items-center gap-1">
                    <Coins className="h-2.5 w-2.5" />
                    Points to Use
                  </span>
                  <Input
                    type="number"
                    min="0"
                    max={maxPointsToUse}
                    value={pointsToUse || ''}
                    onChange={(e) => handlePointsChange(e.target.value)}
                    placeholder="0"
                    className="w-20 h-7 text-right text-[11px] bg-zinc-800 border-zinc-700 text-zinc-100"
                  />
                </div>
              )}
              {pointsDiscount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Points Discount</span>
                  <span>-{formatCurrency(pointsDiscount)}</span>
                </div>
              )}
              <Separator className="bg-zinc-800" />
              <div className="flex justify-between text-sm font-bold text-zinc-100">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Payment Method */}
            {renderPaymentButtons(false)}

            {paymentMethod === 'CASH' && (
              <div className="space-y-1">
                <Label className="text-[11px] text-zinc-400">Paid Amount</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder="0"
                  className="h-8 text-sm bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                />
                {Number(paidAmount) >= total && total > 0 && (
                  <div className="flex justify-between text-xs text-emerald-400">
                    <span>Change</span>
                    <span className="font-semibold">{formatCurrency(change)}</span>
                  </div>
                )}
              </div>
            )}

            {paymentMethod === 'QRIS' && (
              <div className="p-3 rounded-lg bg-zinc-800 border border-zinc-700 text-center">
                <QrCode className="h-12 w-12 text-zinc-500 mx-auto mb-1.5" />
                <p className="text-[11px] text-zinc-400">Scan QRIS code to pay</p>
                <p className="text-xs font-bold text-zinc-200 mt-0.5">{formatCurrency(total)}</p>
              </div>
            )}

            {paymentMethod === 'DEBIT' && (
              <div className="p-3 rounded-lg bg-zinc-800 border border-zinc-700 text-center">
                <CreditCard className="h-12 w-12 text-zinc-500 mx-auto mb-1.5" />
                <p className="text-[11px] text-zinc-400">Insert or tap debit card</p>
                <p className="text-xs font-bold text-zinc-200 mt-0.5">{formatCurrency(total)}</p>
              </div>
            )}

            <Button
              onClick={openCheckoutDialog}
              disabled={cart.length === 0 || checkingOut}
              className="w-full h-10 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm"
            >
              {checkingOut ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Process Payment
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile layout - Tabs */}
      <div className="md:hidden">
        <Tabs defaultValue="products" className="w-full">
          <TabsList className="w-full bg-zinc-900 border border-zinc-800 rounded-lg h-10">
            <TabsTrigger
              value="products"
              className="flex-1 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 text-zinc-400 rounded-md h-8 text-xs"
            >
              <Package className="mr-1 h-3.5 w-3.5" />
              Products
            </TabsTrigger>
            <TabsTrigger
              value="cart"
              className="flex-1 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 text-zinc-400 rounded-md h-8 text-xs relative"
            >
              <ShoppingCart className="mr-1 h-3.5 w-3.5" />
              Cart
              {cart.length > 0 && (
                <span className="ml-1 w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] flex items-center justify-center font-bold">
                  {cart.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-3">
            {renderSearchInput()}
            <div className="grid grid-cols-2 gap-2">
              {renderProductGrid(true)}
            </div>
            {renderPagination()}
          </TabsContent>

          <TabsContent value="cart" className="mt-3 space-y-3">
            {/* Customer Selector - Mobile */}
            {renderCustomerSelector(true)}

            {/* Cart items - Mobile */}
            <div className="space-y-2">
              {cart.length === 0 ? (
                <div className="text-center py-6">
                  <ShoppingCart className="h-7 w-7 text-zinc-600 mx-auto mb-1.5" />
                  <p className="text-zinc-500 text-xs">Cart is empty</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-200 font-medium truncate">{item.product.name}</p>
                      <p className="text-[11px] text-zinc-400">{formatCurrency(item.product.price)} × {item.qty}</p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                        onClick={() => updateQty(item.product.id, item.qty - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-[11px] w-4 text-center text-zinc-200">{item.qty}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                        onClick={() => updateQty(item.product.id, item.qty + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-emerald-400 font-semibold">{formatCurrency(item.product.price * item.qty)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-zinc-500 hover:text-red-400"
                      onClick={() => removeFromCart(item.product.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            {/* Summary - Mobile */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-2.5">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Subtotal</span>
                  <span className="text-zinc-200">{formatCurrency(subtotal)}</span>
                </div>
                {selectedCustomer && maxPointsToUse > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-[11px]">Points to Use</span>
                    <Input
                      type="number"
                      min="0"
                      max={maxPointsToUse}
                      value={pointsToUse || ''}
                      onChange={(e) => handlePointsChange(e.target.value)}
                      placeholder="0"
                      className="w-20 h-6 text-right text-[11px] bg-zinc-800 border-zinc-700 text-zinc-100"
                    />
                  </div>
                )}
                {pointsDiscount > 0 && (
                  <div className="flex justify-between text-emerald-400 text-[11px]">
                    <span>Points Discount</span>
                    <span>-{formatCurrency(pointsDiscount)}</span>
                  </div>
                )}
                <Separator className="bg-zinc-800" />
                <div className="flex justify-between text-sm font-bold text-zinc-100">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              {renderPaymentButtons(true)}

              {paymentMethod === 'CASH' && (
                <div className="space-y-1">
                  <Label className="text-[11px] text-zinc-400">Paid Amount</Label>
                  <Input
                    type="number"
                    min="0"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder="0"
                    className="h-8 text-sm bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                  />
                  {Number(paidAmount) >= total && total > 0 && (
                    <p className="text-[11px] text-emerald-400 text-right">
                      Change: {formatCurrency(change)}
                    </p>
                  )}
                </div>
              )}

              <Button
                onClick={openCheckoutDialog}
                disabled={cart.length === 0}
                className="w-full h-10 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm"
              >
                <Check className="mr-2 h-4 w-4" />
                Process Payment
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Checkout Confirmation Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={(open) => { if (!open) setCheckoutOpen(false) }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-zinc-100 text-sm">Confirm Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-2.5 py-1">
            <div className="space-y-1 text-xs">
              {cart.map((item) => (
                <div key={item.product.id} className="flex justify-between text-zinc-300 py-0.5">
                  <span>{item.product.name} × {item.qty}</span>
                  <span>{formatCurrency(item.product.price * item.qty)}</span>
                </div>
              ))}
              <Separator className="bg-zinc-800 my-1.5" />
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {pointsDiscount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Points Discount</span>
                  <span>-{formatCurrency(pointsDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-zinc-100 pt-0.5">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            <Separator className="bg-zinc-800" />

            <div className="text-xs space-y-1">
              <div className="flex justify-between text-zinc-400">
                <span>Payment Method</span>
                <span className="text-zinc-200 flex items-center gap-1.5">
                  {getPaymentIcon()} {getPaymentLabel()}
                </span>
              </div>
              {paymentMethod === 'CASH' && (
                <>
                  <div className="flex justify-between text-zinc-400">
                    <span>Paid</span>
                    <span className="text-zinc-200">{formatCurrency(Number(paidAmount))}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400">
                    <span>Change</span>
                    <span>{formatCurrency(change)}</span>
                  </div>
                </>
              )}
              {(paymentMethod === 'QRIS' || paymentMethod === 'DEBIT') && (
                <div className="flex justify-between text-zinc-400">
                  <span>Paid</span>
                  <span className="text-zinc-200">{formatCurrency(total)}</span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-zinc-500">
              Customer: {selectedCustomer ? selectedCustomer.name : 'Walk-in'}
            </p>
          </div>
          <DialogFooter className="gap-2 pt-1">
            <Button
              variant="ghost"
              onClick={() => setCheckoutOpen(false)}
              className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCheckout}
              disabled={checkingOut || (paymentMethod === 'CASH' && Number(paidAmount) < total)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs"
            >
              {checkingOut && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={(open) => { if (!open) handleReceiptSkip() }}>
        <DialogContent className="bg-white border-zinc-200 max-w-lg p-0 overflow-hidden">
          {checkoutResult && (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>Receipt - {checkoutResult.invoiceNumber}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[80vh]">
                <div className="p-5">
                  {/* Success badge */}
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                      checkoutResult.invoiceNumber?.startsWith('OFF-')
                        ? 'bg-amber-100'
                        : 'bg-emerald-100'
                    }`}>
                      {checkoutResult.invoiceNumber?.startsWith('OFF-') ? (
                        <CloudOff className="h-4 w-4 text-amber-600" />
                      ) : (
                        <Check className="h-4 w-4 text-emerald-600" />
                      )}
                    </div>
                    <div className="text-left">
                      <p className={`text-xs font-semibold ${
                        checkoutResult.invoiceNumber?.startsWith('OFF-')
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}>
                        {checkoutResult.invoiceNumber?.startsWith('OFF-') ? 'Saved Offline' : 'Payment Successful'}
                      </p>
                      {checkoutResult.invoiceNumber?.startsWith('OFF-') && (
                        <p className="text-[10px] text-amber-500">Will sync when online</p>
                      )}
                    </div>
                  </div>

                  {/* Receipt */}
                  {renderReceipt()}
                </div>
              </ScrollArea>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 p-3 border-t border-zinc-200 bg-zinc-50">
                <Button
                  onClick={handleReceiptPrint}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-sm"
                >
                  Print Receipt
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReceiptSkip}
                  className="flex-1 border-zinc-300 text-zinc-600 hover:bg-zinc-100 text-sm"
                >
                  Skip
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
