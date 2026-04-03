'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { formatCurrency, formatNumber, formatDate } from '@/lib/format'
import { usePlan, useFeatureGate } from '@/hooks/use-plan'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Loader2,
  Coins,
  Crown,
  ChevronDown,
  ChevronUp,
  History,
  Lock,
  Sparkles,
  MinusCircle,
  PlusCircle,
} from 'lucide-react'
import CustomerFormDialog from './customer-form-dialog'

// ============================================================
// Types
// ============================================================

interface Customer {
  id: string
  name: string
  whatsapp: string
  totalSpend: number
  points: number
}

interface CustomerListResponse {
  customers: Customer[]
  totalPages: number
}

interface LoyaltyLog {
  id: string
  type: string
  points: number
  description: string
  createdAt: string
}

interface PurchaseItem {
  productName: string
  qty: number
  price: number
  subtotal: number
}

interface Purchase {
  id: string
  invoiceNumber: string
  date: string
  itemCount: number
  total: number
  paymentMethod: string
  items: PurchaseItem[]
}

// ============================================================
// Tier calculation (client-side)
// ============================================================

type CustomerTier = 'New' | 'Regular' | 'VIP'

function getTier(totalSpend: number): CustomerTier {
  if (totalSpend === 0) return 'New'
  if (totalSpend < 500000) return 'Regular'
  return 'VIP'
}

function getTierBadgeClass(tier: CustomerTier): string {
  switch (tier) {
    case 'New':
      return 'bg-zinc-500/10 border-zinc-500/20 text-zinc-400'
    case 'Regular':
      return 'bg-blue-500/10 border-blue-500/20 text-blue-400'
    case 'VIP':
      return 'bg-amber-500/10 border-amber-500/20 text-amber-400'
  }
}

function getNextTierInfo(tier: CustomerTier, totalSpend: number): { label: string; target: number; progress: number } | null {
  if (tier === 'VIP') return null // Already max tier
  if (tier === 'New') {
    return { label: 'Regular', target: 1, progress: 0 }
  }
  // Regular → VIP (500K)
  return { label: 'VIP', target: 500000, progress: Math.min(100, (totalSpend / 500000) * 100) }
}

// ============================================================
// Component
// ============================================================

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Loyalty history sheet
  const [loyaltyOpen, setLoyaltyOpen] = useState(false)
  const [loyaltyCustomer, setLoyaltyCustomer] = useState<Customer | null>(null)
  const [loyaltyLogs, setLoyaltyLogs] = useState<LoyaltyLog[]>([])
  const [loyaltyLoading, setLoyaltyLoading] = useState(false)

  // Purchase history sheet
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [purchaseCustomer, setPurchaseCustomer] = useState<Customer | null>(null)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [purchaseLoading, setPurchaseLoading] = useState(false)
  const [expandedTx, setExpandedTx] = useState<string | null>(null)

  // Manual points adjust dialog
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustCustomer, setAdjustCustomer] = useState<Customer | null>(null)
  const [adjustType, setAdjustType] = useState<'ADD' | 'DEDUCT'>('ADD')
  const [adjustPoints, setAdjustPoints] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  // Plan gating
  const { plan, features } = usePlan()
  const isPro = plan?.type === 'pro' || plan?.type === 'enterprise'

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      const res = await fetch(`/api/customers?${params}`)
      if (res.ok) {
        const data: CustomerListResponse = await res.json()
        setCustomers(data.customers)
        setTotalPages(data.totalPages)
      } else {
        toast.error('Failed to load customers')
      }
    } catch {
      toast.error('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const handleEdit = (customer: Customer) => {
    setEditCustomer(customer)
    setFormOpen(true)
  }

  const handleAdd = () => {
    setEditCustomer(null)
    setFormOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/customers/${deleteId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Customer deleted')
        fetchCustomers()
      } else {
        toast.error('Failed to delete customer')
      }
    } catch {
      toast.error('Failed to delete customer')
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  const handleViewLoyalty = async (customer: Customer) => {
    setLoyaltyCustomer(customer)
    setLoyaltyOpen(true)
    setLoyaltyLoading(true)
    try {
      const res = await fetch(`/api/customers/${customer.id}/loyalty`)
      if (res.ok) {
        const data = await res.json()
        setLoyaltyLogs(data.logs || [])
      }
    } catch {
      toast.error('Failed to load loyalty history')
    } finally {
      setLoyaltyLoading(false)
    }
  }

  const handleViewPurchases = async (customer: Customer) => {
    if (!isPro) {
      setPurchaseCustomer(customer)
      setPurchaseOpen(true)
      setPurchases([])
      return
    }
    setPurchaseCustomer(customer)
    setPurchaseOpen(true)
    setPurchaseLoading(true)
    setExpandedTx(null)
    try {
      const res = await fetch(`/api/customers/${customer.id}/purchases`)
      if (res.ok) {
        const data = await res.json()
        setPurchases(data.purchases || [])
      }
    } catch {
      toast.error('Failed to load purchase history')
    } finally {
      setPurchaseLoading(false)
    }
  }

  const handleAdjustPoints = (customer: Customer) => {
    setAdjustCustomer(customer)
    setAdjustType('ADD')
    setAdjustPoints('')
    setAdjustReason('')
    setAdjustOpen(true)
  }

  const submitAdjustPoints = async () => {
    if (!adjustCustomer) return
    const pts = parseInt(adjustPoints)
    if (!pts || pts <= 0) {
      toast.error('Points must be greater than 0')
      return
    }
    if (!adjustReason.trim()) {
      toast.error('Reason is required')
      return
    }

    setAdjusting(true)
    try {
      const res = await fetch(`/api/customers/${adjustCustomer.id}/loyalty/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: adjustType,
          points: pts,
          reason: adjustReason.trim(),
        }),
      })
      if (res.ok) {
        toast.success(`Points ${adjustType === 'ADD' ? 'added' : 'deducted'} successfully`)
        setAdjustOpen(false)
        // Refresh loyalty logs if open
        if (loyaltyOpen && adjustCustomer.id === loyaltyCustomer?.id) {
          handleViewLoyalty(adjustCustomer)
        }
        // Refresh customer list
        fetchCustomers()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to adjust points')
      }
    } catch {
      toast.error('Failed to adjust points')
    } finally {
      setAdjusting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Customers</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Manage your customer database & CRM</p>
        </div>
        <Button onClick={handleAdd} className="bg-emerald-500 hover:bg-emerald-600 text-white h-8 text-xs">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Customer
        </Button>
      </div>

      {/* Search */}
      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
        <Input
          placeholder="Search customers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 sm:h-10 text-xs bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 bg-zinc-900 rounded" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
          <p className="text-xs text-zinc-500">No customers found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Mobile card view */}
          <div className="md:hidden space-y-2">
            {customers.map((customer) => {
              const tier = getTier(customer.totalSpend)
              return (
                <div
                  key={customer.id}
                  className="rounded-xl bg-zinc-900 border border-zinc-800/60 p-3 cursor-pointer"
                  onClick={() => handleViewPurchases(customer)}
                >
                  {/* Top row: Name + Tier badge */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-200 font-semibold truncate mr-2">{customer.name}</span>
                    <Badge className={`${getTierBadgeClass(tier)} text-[10px] font-medium border px-1.5 py-0 shrink-0`}>
                      {tier === 'VIP' && <Crown className="mr-0.5 h-2.5 w-2.5" />}
                      {tier}
                    </Badge>
                  </div>
                  {/* Middle row: WhatsApp + Total spend */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-400">{customer.whatsapp}</span>
                    <span className="text-xs text-zinc-200 font-medium">{formatCurrency(customer.totalSpend)}</span>
                  </div>
                  {/* Bottom row: Points badge + Action buttons */}
                  <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                    <Badge className="bg-amber-500/10 border-amber-500/20 text-amber-400 text-[10px]">
                      <Coins className="mr-0.5 h-2.5 w-2.5" />
                      {formatNumber(customer.points)} pts
                    </Badge>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10"
                        onClick={() => handleViewPurchases(customer)}
                        title="Riwayat"
                      >
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10"
                        onClick={() => handleViewLoyalty(customer)}
                        title="Loyalty"
                      >
                        <Coins className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                        onClick={() => handleEdit(customer)}
                        title="Edit"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => setDeleteId(customer.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block rounded-lg border border-zinc-800 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-500 text-[11px] font-medium">Name</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium hidden sm:table-cell">WhatsApp</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium">Tier</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium text-right">Total Spend</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium text-center">Points</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium text-right w-[140px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => {
                  const tier = getTier(customer.totalSpend)
                  return (
                    <TableRow
                      key={customer.id}
                      className="border-zinc-800 hover:bg-zinc-800/50 cursor-pointer"
                      onClick={() => handleViewPurchases(customer)}
                    >
                      <TableCell className="text-xs text-zinc-200 font-medium py-2.5 px-3">{customer.name}</TableCell>
                      <TableCell className="text-xs text-zinc-400 py-2.5 px-3 hidden sm:table-cell">{customer.whatsapp}</TableCell>
                      <TableCell className="py-2.5 px-3">
                        <Badge className={`${getTierBadgeClass(tier)} text-[10px] font-medium border px-1.5 py-0`}>
                          {tier === 'VIP' && <Crown className="mr-0.5 h-2.5 w-2.5" />}
                          {tier}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-200 text-right py-2.5 px-3">{formatCurrency(customer.totalSpend)}</TableCell>
                      <TableCell className="text-center py-2.5 px-3">
                        <Badge className="bg-amber-500/10 border-amber-500/20 text-amber-400 text-[10px]">
                          <Coins className="mr-0.5 h-2.5 w-2.5" />
                          {formatNumber(customer.points)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10"
                            onClick={() => handleViewPurchases(customer)}
                            title="Riwayat"
                          >
                            <History className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10"
                            onClick={() => handleViewLoyalty(customer)}
                            title="Loyalty"
                          >
                            <Coins className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                            onClick={() => handleEdit(customer)}
                            title="Edit"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                            onClick={() => setDeleteId(customer.id)}
                            title="Delete"
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
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Customer Form Dialog */}
      <CustomerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={editCustomer}
        onSaved={fetchCustomers}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100 text-sm font-semibold">Delete Customer</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 text-xs">
              Are you sure? This will permanently delete this customer and their loyalty history.
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

      {/* Loyalty History Sheet */}
      <Sheet open={loyaltyOpen} onOpenChange={setLoyaltyOpen}>
        <SheetContent className="bg-zinc-900 border-zinc-800 w-full sm:max-w-md p-0">
          <SheetHeader className="p-4 pb-3">
            <SheetTitle className="text-zinc-100 text-sm font-semibold flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-400" />
              Loyalty — {loyaltyCustomer?.name}
            </SheetTitle>
          </SheetHeader>
          {loyaltyCustomer && (
            <div className="px-4 pb-4 space-y-3">
              {/* Customer summary */}
              <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Tier</span>
                  <Badge className={`${getTierBadgeClass(getTier(loyaltyCustomer.totalSpend))} text-[10px] font-medium border px-1.5 py-0`}>
                    {getTier(loyaltyCustomer.totalSpend) === 'VIP' && <Crown className="mr-0.5 h-2.5 w-2.5" />}
                    {getTier(loyaltyCustomer.totalSpend)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Total Spend</span>
                  <span className="text-xs font-semibold text-zinc-200">{formatCurrency(loyaltyCustomer.totalSpend)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Current Points</span>
                  <Badge className="bg-amber-500/20 border-amber-500/30 text-amber-400 text-[10px]">
                    {formatNumber(loyaltyCustomer.points)} pts
                  </Badge>
                </div>

                {/* Loyalty progress bar — points to next tier */}
                {(() => {
                  const tier = getTier(loyaltyCustomer.totalSpend)
                  const nextTier = getNextTierInfo(tier, loyaltyCustomer.totalSpend)
                  if (!nextTier) {
                    return (
                      <div className="pt-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-zinc-500">Loyalty Progress</span>
                          <span className="text-[11px] text-amber-400 font-medium">Max tier reached! 🎉</span>
                        </div>
                        <Progress value={100} className="h-1.5 bg-zinc-700 [&>div]:bg-amber-400" />
                      </div>
                    )
                  }
                  if (tier === 'New') {
                    return (
                      <div className="pt-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-zinc-500">Loyalty Progress</span>
                          <span className="text-[11px] text-blue-400 font-medium">First purchase to unlock Regular</span>
                        </div>
                        <Progress value={0} className="h-1.5 bg-zinc-700 [&>div]:bg-blue-400" />
                      </div>
                    )
                  }
                  return (
                    <div className="pt-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-zinc-500">Loyalty Progress</span>
                        <span className="text-[11px] text-blue-400 font-medium">
                          {formatCurrency(loyaltyCustomer.totalSpend)} / {formatCurrency(nextTier.target)} ke {nextTier.label}
                        </span>
                      </div>
                      <Progress value={nextTier.progress} className="h-1.5 bg-zinc-700 [&>div]:bg-blue-400" />
                    </div>
                  )
                })()}
              </div>

              {/* Manual adjust button — OWNER only */}
              {plan?.type && (
                <Button
                  variant="outline"
                  className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 h-8 text-xs"
                  onClick={() => handleAdjustPoints(loyaltyCustomer)}
                >
                  <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                  Adjust Points (Manual)
                </Button>
              )}

              <Separator className="bg-zinc-800" />

              {/* Loyalty logs */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-300 mb-2">Points History</h3>
                {loyaltyLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 bg-zinc-800 rounded" />
                    ))}
                  </div>
                ) : loyaltyLogs.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-6">No loyalty history</p>
                ) : (
                  <div className="space-y-1.5 max-h-96 overflow-y-auto">
                    {loyaltyLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-800"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Badge
                            className={`text-[10px] ${
                              log.type === 'EARN'
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                : log.type === 'ADJUST'
                                ? 'bg-violet-500/10 border-violet-500/20 text-violet-400'
                                : 'bg-red-500/10 border-red-500/20 text-red-400'
                            }`}
                          >
                            {log.type}
                          </Badge>
                          <span className={`text-xs font-semibold ${log.points > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {log.points > 0 ? '+' : ''}{log.points} pts
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5">{log.description}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{formatDate(log.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Purchase History Sheet */}
      <Sheet open={purchaseOpen} onOpenChange={setPurchaseOpen}>
        <SheetContent className="bg-zinc-900 border-zinc-800 w-full sm:max-w-md p-0">
          <SheetHeader className="p-4 pb-3">
            <SheetTitle className="text-zinc-100 text-sm font-semibold flex items-center gap-2">
              <History className="h-4 w-4 text-blue-400" />
              Riwayat — {purchaseCustomer?.name}
            </SheetTitle>
          </SheetHeader>
          {purchaseCustomer && (
            <div className="px-4 pb-4 space-y-3">
              {/* Customer info header */}
              <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Tier</span>
                  <Badge className={`${getTierBadgeClass(getTier(purchaseCustomer.totalSpend))} text-[10px] font-medium border px-1.5 py-0`}>
                    {getTier(purchaseCustomer.totalSpend) === 'VIP' && <Crown className="mr-0.5 h-2.5 w-2.5" />}
                    {getTier(purchaseCustomer.totalSpend)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Total Spend</span>
                  <span className="text-xs font-semibold text-zinc-200">{formatCurrency(purchaseCustomer.totalSpend)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Points</span>
                  <Badge className="bg-amber-500/10 border-amber-500/20 text-amber-400 text-[10px]">
                    {formatNumber(purchaseCustomer.points)} pts
                  </Badge>
                </div>
              </div>

              {/* Pro-gated content */}
              {!isPro ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-3 text-center">
                  <div className="h-12 w-12 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                    <Lock className="h-5 w-5 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">Fitur Pro</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Riwayat pembelian customer tersedia untuk akun Pro dan Enterprise.
                    </p>
                  </div>
                  <Button
                    className="bg-violet-500 hover:bg-violet-600 text-white h-8 text-xs"
                  >
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    Upgrade ke Pro
                  </Button>
                </div>
              ) : (
                <>
                  <Separator className="bg-zinc-800" />

                  <div>
                    <h3 className="text-xs font-semibold text-zinc-300 mb-2">Riwayat Transaksi</h3>
                    {purchaseLoading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-16 bg-zinc-800 rounded" />
                        ))}
                      </div>
                    ) : purchases.length === 0 ? (
                      <p className="text-xs text-zinc-500 text-center py-6">Belum ada transaksi</p>
                    ) : (
                      <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
                        {purchases.map((purchase) => {
                          const isExpanded = expandedTx === purchase.id
                          return (
                            <div
                              key={purchase.id}
                              className="rounded-lg bg-zinc-800/50 border border-zinc-800 overflow-hidden"
                            >
                              {/* Transaction header — clickable to expand */}
                              <button
                                className="w-full p-2.5 flex items-center justify-between hover:bg-zinc-800 transition-colors"
                                onClick={() => setExpandedTx(isExpanded ? null : purchase.id)}
                              >
                                <div className="flex-1 text-left min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-xs font-medium text-zinc-200 truncate">
                                      {purchase.invoiceNumber}
                                    </span>
                                    <Badge className="bg-zinc-700/50 border-zinc-600/50 text-zinc-400 text-[10px] shrink-0 px-1 py-0">
                                      {purchase.paymentMethod}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                                    <span>{formatDate(purchase.date)}</span>
                                    <span>{purchase.itemCount} item</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                  <span className="text-xs font-semibold text-zinc-200">
                                    {formatCurrency(purchase.total)}
                                  </span>
                                  {isExpanded ? (
                                    <ChevronUp className="h-3.5 w-3.5 text-zinc-500" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                                  )}
                                </div>
                              </button>

                              {/* Expanded items */}
                              {isExpanded && (
                                <div className="px-2.5 pb-2.5 border-t border-zinc-800">
                                  <div className="pt-1.5 space-y-1">
                                    {purchase.items.map((item, idx) => (
                                      <div key={idx} className="flex items-center justify-between py-0.5">
                                        <div className="flex-1 min-w-0">
                                          <span className="text-[11px] text-zinc-300 truncate block">{item.productName}</span>
                                          <span className="text-[10px] text-zinc-500">
                                            {formatNumber(item.qty)} × {formatCurrency(item.price)}
                                          </span>
                                        </div>
                                        <span className="text-[11px] text-zinc-400 shrink-0 ml-2">
                                          {formatCurrency(item.subtotal)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}

                        {/* Summary */}
                        <div className="pt-1.5 pb-0.5">
                          <p className="text-[11px] text-zinc-500 text-center">
                            Total transaksi: {purchases.length}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Manual Adjust Points Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-sm p-4">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 text-sm font-semibold flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-400" />
              Adjust Points — {adjustCustomer?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-xs">Tipe</Label>
              <Select value={adjustType} onValueChange={(v: 'ADD' | 'DEDUCT') => setAdjustType(v)}>
                <SelectTrigger className="h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="ADD" className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100 text-xs">
                    <div className="flex items-center gap-2">
                      <PlusCircle className="h-3.5 w-3.5 text-emerald-400" />
                      Tambah Poin (ADD)
                    </div>
                  </SelectItem>
                  <SelectItem value="DEDUCT" className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100 text-xs">
                    <div className="flex items-center gap-2">
                      <MinusCircle className="h-3.5 w-3.5 text-red-400" />
                      Kurangi Poin (DEDUCT)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-xs">Jumlah Poin</Label>
              <Input
                type="number"
                min="1"
                value={adjustPoints}
                onChange={(e) => setAdjustPoints(e.target.value)}
                placeholder="Masukkan jumlah poin"
                className="h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
              />
              {adjustCustomer && adjustType === 'DEDUCT' && (
                <p className="text-[11px] text-zinc-500">
                  Poin tersedia: {formatNumber(adjustCustomer.points)} pts
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-xs">Alasan</Label>
              <Textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Contoh: Bonus ulang tahun, Kompensasi komplain, dll."
                rows={3}
                className="text-xs bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
              />
            </div>

            {/* Preview */}
            {adjustPoints && parseInt(adjustPoints) > 0 && (
              <div className={`p-2.5 rounded-lg border ${
                adjustType === 'ADD'
                  ? 'bg-emerald-500/10 border-emerald-500/20'
                  : 'bg-red-500/10 border-red-500/20'
              }`}>
                <p className={`text-xs font-medium ${adjustType === 'ADD' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {adjustType === 'ADD' ? '+' : '-'}{formatNumber(parseInt(adjustPoints))} poin
                </p>
                {adjustCustomer && (
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Poin setelah: {formatNumber(
                      adjustType === 'ADD'
                        ? adjustCustomer.points + parseInt(adjustPoints)
                        : Math.max(0, adjustCustomer.points - parseInt(adjustPoints))
                    )} pts
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAdjustOpen(false)}
              className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 h-8 text-xs"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={submitAdjustPoints}
              disabled={adjusting || !adjustPoints || !adjustReason.trim()}
              className={`${
                adjustType === 'ADD'
                  ? 'bg-emerald-500 hover:bg-emerald-600'
                  : 'bg-red-500 hover:bg-red-600'
              } text-white h-8 text-xs`}
            >
              {adjusting && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              {adjustType === 'ADD' ? 'Tambah' : 'Kurangi'} Poin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
