'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ProGate } from '@/components/shared/pro-gate'
import {
  Banknote,
  QrCode,
  CreditCard,
  Store,
  Users,
  Star,
  Tag,
  Palette,
  Receipt,
  Save,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Check,
  Shield,
  Send,
  KeyRound,
  Building2,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  Link2,
  Unlink2,
} from 'lucide-react'

// ==================== TYPES ====================

interface SettingsData {
  id: string
  outletId: string
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
  telegramChatId: string | null
  telegramBotToken: string | null
  notifyOnTransaction: boolean
  notifyOnCustomer: boolean
  notifyDailyReport: boolean
  notifyWeeklyReport: boolean
  notifyMonthlyReport: boolean
  outlet?: { id: string; name: string; address: string | null; phone: string | null }
}

interface Promo {
  id: string
  name: string
  type: string
  value: number
  minPurchase: number | null
  maxDiscount: number | null
  active: boolean
}

interface CrewPermission {
  userId: string
  userName: string
  userEmail: string
  role: string
  pages: string
}

interface PromoFormData {
  name: string
  type: string
  value: string
  minPurchase: string
  maxDiscount: string
  active: boolean
}

const DEFAULT_PROMO_FORM: PromoFormData = {
  name: '',
  type: 'PERCENTAGE',
  value: '',
  minPurchase: '',
  maxDiscount: '',
  active: true,
}

const AVAILABLE_PAGES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'products', label: 'Produk' },
  { key: 'customers', label: 'Pelanggan' },
  { key: 'pos', label: 'POS' },
  { key: 'transactions', label: 'Transaksi' },
  { key: 'audit-log', label: 'Audit Log' },
  { key: 'settings', label: 'Pengaturan' },
]

const THEME_COLORS = [
  { name: 'emerald', label: 'Emerald', classes: 'bg-emerald-500' },
  { name: 'blue', label: 'Biru', classes: 'bg-blue-500' },
  { name: 'violet', label: 'Violet', classes: 'bg-violet-500' },
  { name: 'rose', label: 'Rose', classes: 'bg-rose-500' },
  { name: 'amber', label: 'Amber', classes: 'bg-amber-500' },
  { name: 'cyan', label: 'Cyan', classes: 'bg-cyan-500' },
]

// ==================== MAIN COMPONENT ====================

export default function SettingsPage() {
  const { data: session } = useSession()
  const isOwner = session?.user?.role === 'OWNER'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Pengaturan</h1>
        <p className="text-xs text-zinc-400 mt-0.5">Konfigurasi outlet dan preferensi sistem</p>
      </div>

      <SettingsTabs isOwner={isOwner} />
    </div>
  )
}

// ==================== TABS WRAPPER ====================

function SettingsTabs({ isOwner }: { isOwner: boolean }) {
  const [activeTab, setActiveTab] = useState('payment')

  const tabs = [
    { value: 'payment', label: 'Pembayaran', icon: <Banknote className="h-4 w-4" /> },
    { value: 'outlet', label: 'Info Outlet', icon: <Store className="h-4 w-4" /> },
    ...(isOwner ? [{ value: 'crew', label: 'Hak Akses', icon: <Shield className="h-4 w-4" /> }] : []),
    { value: 'loyalty', label: 'Loyalty', icon: <Star className="h-4 w-4" /> },
    ...(isOwner ? [{ value: 'promo', label: 'Promo', icon: <Tag className="h-4 w-4" /> }] : []),
    { value: 'theme', label: 'Tema & Struk', icon: <Palette className="h-4 w-4" /> },
    ...(isOwner ? [{ value: 'telegram', label: 'Telegram', icon: <Send className="h-4 w-4" /> }] : []),
    { value: 'account', label: 'Akun', icon: <KeyRound className="h-4 w-4" /> },
    ...(isOwner ? [{ value: 'multi-outlet', label: 'Outlet Cabang', icon: <Building2 className="h-4 w-4" /> }] : []),
  ]

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      {/* Horizontal scrollable tab bar - no scrollbar */}
      <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
        <TabsList className="inline-flex h-auto w-max gap-1 bg-transparent p-0">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 data-[state=active]:shadow-sm data-[state=active]:shadow-emerald-500/10 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80 transition-all duration-150 border border-transparent data-[state=active]:border-emerald-500/20 data-[state=active]:shadow-none"
            >
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <div className="min-w-0">
        <TabsContent value="payment">
          <PaymentMethodsTab />
        </TabsContent>
        <TabsContent value="outlet">
          <OutletInfoTab />
        </TabsContent>
        {isOwner && (
          <TabsContent value="crew">
            <ProGate feature="crewPermissions" label="Hak Akses Crew" description="Kelola akses halaman per crew member" minHeight="200px">
              <CrewAccessTab />
            </ProGate>
          </TabsContent>
        )}
        <TabsContent value="loyalty">
          <LoyaltyTab />
        </TabsContent>
        {isOwner && (
          <TabsContent value="promo">
            <PromoTab />
          </TabsContent>
        )}
        <TabsContent value="theme">
          <ThemeReceiptTab />
        </TabsContent>
        {isOwner && (
          <TabsContent value="telegram">
            <ProGate feature="apiAccess" label="Telegram Notifikasi" description="Kirim notifikasi otomatis via Telegram" minHeight="200px">
              <TelegramTab />
            </ProGate>
          </TabsContent>
        )}
        <TabsContent value="account">
          <AccountTab />
        </TabsContent>
        {isOwner && (
          <TabsContent value="multi-outlet">
            <ProGate feature="multiOutlet" label="Multi-Outlet" description="Kelola beberapa outlet dalam satu akun" minHeight="200px">
              <MultiOutletTab />
            </ProGate>
          </TabsContent>
        )}
      </div>
    </Tabs>
  )
}

// ==================== SHARED HOOK ====================

function useSettings() {
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        setSettings(data)
      } else {
        toast.error('Gagal memuat pengaturan')
      }
    } catch {
      toast.error('Gagal memuat pengaturan')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const saveSettings = useCallback(async (updates: Partial<SettingsData>) => {
    if (!settings) {
      toast.error('Pengaturan belum dimuat, silakan tunggu')
      return false
    }
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        const data = await res.json()
        setSettings(data)
        toast.success('Pengaturan berhasil disimpan')
        return true
      } else {
        const errData = await res.json().catch(() => ({}))
        if (res.status === 403) {
          toast.error(errData.error || 'Hanya pemilik (OWNER) yang dapat mengubah pengaturan')
        } else {
          toast.error(errData.error || 'Gagal menyimpan pengaturan')
        }
        return false
      }
    } catch {
      toast.error('Gagal menyimpan pengaturan — periksa koneksi internet')
      return false
    } finally {
      setSaving(false)
    }
  }, [settings])

  return { settings, setSettings, loading, saving, saveSettings, refetch: fetchSettings }
}

// ==================== TAB 1: PAYMENT METHODS ====================

function PaymentMethodsTab() {
  const { settings, loading, saving, saveSettings } = useSettings()
  const [editedPaymentMethods, setEditedPaymentMethods] = useState<string | null>(null)

  const paymentMethods = [
    { key: 'CASH', label: 'Tunai (CASH)', icon: <Banknote className="h-5 w-5" />, desc: 'Pembayaran tunai langsung' },
    { key: 'QRIS', label: 'QRIS', icon: <QrCode className="h-5 w-5" />, desc: 'Scan QR untuk pembayaran' },
    { key: 'DEBIT', label: 'Debit/Credit', icon: <CreditCard className="h-5 w-5" />, desc: 'Kartu debit atau kredit' },
  ]

  const currentPaymentMethods = editedPaymentMethods ?? settings?.paymentMethods ?? 'CASH,QRIS'
  const currentEnabled = currentPaymentMethods.split(',').filter(Boolean)

  const handleToggle = (key: string) => {
    const isActive = currentEnabled.includes(key)
    const updated = isActive
      ? currentEnabled.filter((m) => m !== key)
      : [...currentEnabled, key]
    if (updated.length === 0) {
      toast.error('Minimal satu metode pembayaran harus aktif')
      return
    }
    setEditedPaymentMethods(updated.join(','))
  }

  const handleSave = async () => {
    if (!settings) {
      toast.error('Pengaturan belum dimuat, silakan tunggu')
      return
    }
    const ok = await saveSettings({ paymentMethods: currentPaymentMethods })
    if (ok) {
      setEditedPaymentMethods(null)
    }
  }

  if (loading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-5 w-36 bg-zinc-800" />
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 bg-zinc-800 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardContent className="p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Metode Pembayaran</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Pilih metode pembayaran yang tersedia di outlet Anda</p>
        </div>

        <div className="grid gap-3">
          {paymentMethods.map((method) => {
            const isActive = currentEnabled.includes(method.key)
            return (
              <div
                key={method.key}
                role="button"
                tabIndex={0}
                onClick={() => handleToggle(method.key)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(method.key) } }}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                  isActive
                    ? 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'
                    : 'border-zinc-800 bg-zinc-800/50 hover:bg-zinc-800'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                }`}>
                  {method.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isActive ? 'text-emerald-400' : 'text-zinc-300'}`}>
                    {method.label}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">{method.desc}</p>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={() => handleToggle(method.key)}
                  onClick={(e) => e.stopPropagation()}
                  className="data-[state=checked]:bg-emerald-500"
                />
              </div>
            )
          })}
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-500 hover:bg-emerald-600 text-white h-9 text-xs"
          >
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            Simpan
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ==================== TAB 2: OUTLET INFO ====================

function OutletInfoTab() {
  const { settings, loading, saving, saveSettings, refetch } = useSettings()
  const [edits, setEdits] = useState<Record<string, string> | null>(null)

  const outletName = edits?.outletName ?? settings?.outlet?.name ?? ''
  const outletAddress = edits?.outletAddress ?? settings?.outlet?.address ?? ''
  const outletPhone = edits?.outletPhone ?? settings?.outlet?.phone ?? ''
  const dirty = edits !== null

  const handleChange = (key: string, value: string) => {
    setEdits((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!settings) {
      toast.error('Pengaturan belum dimuat, silakan tunggu')
      return
    }
    const ok = await saveSettings({
      outletName,
      outletAddress,
      outletPhone,
    })
    if (ok) {
      setEdits(null)
      refetch()
    }
  }

  if (loading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-5 w-36 bg-zinc-800" />
          <Skeleton className="h-9 bg-zinc-800" />
          <Skeleton className="h-9 bg-zinc-800" />
          <Skeleton className="h-9 bg-zinc-800" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardContent className="p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Informasi Outlet</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Detail informasi usaha Anda</p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="outlet-name" className="text-xs text-zinc-300">Nama Outlet</Label>
            <Input
              id="outlet-name"
              value={outletName}
              onChange={(e) => handleChange('outletName', e.target.value)}
              placeholder="Masukkan nama outlet"
              className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="outlet-address" className="text-xs text-zinc-300">Alamat</Label>
            <Textarea
              id="outlet-address"
              value={outletAddress}
              onChange={(e) => handleChange('outletAddress', e.target.value)}
              placeholder="Masukkan alamat outlet"
              className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="outlet-phone" className="text-xs text-zinc-300">Telepon</Label>
            <Input
              id="outlet-phone"
              value={outletPhone}
              onChange={(e) => handleChange('outletPhone', e.target.value)}
              placeholder="Masukkan nomor telepon"
              className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="bg-emerald-500 hover:bg-emerald-600 text-white h-9 text-xs"
          >
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            Simpan
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ==================== TAB 3: CREW ACCESS ====================

function CrewAccessTab() {
  const [permissions, setPermissions] = useState<CrewPermission[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  const fetchPermissions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings/permissions')
      if (res.ok) {
        const data = await res.json()
        setPermissions(data.permissions || [])
      } else {
        toast.error('Gagal memuat hak akses crew')
      }
    } catch {
      toast.error('Gagal memuat hak akses crew')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  const handleTogglePage = async (userId: string, pageKey: string, currentlyChecked: boolean) => {
    const crew = permissions.find((p) => p.userId === userId)
    if (!crew) return

    const pagesList = crew.pages.split(',').filter(Boolean)
    const updated = currentlyChecked
      ? pagesList.filter((p) => p !== pageKey)
      : [...pagesList, pageKey]

    if (updated.length === 0) {
      toast.error('Minimal satu halaman harus diaktifkan')
      return
    }

    // Optimistic update
    setPermissions((prev) =>
      prev.map((p) =>
        p.userId === userId ? { ...p, pages: updated.join(',') } : p
      )
    )

    setSavingId(userId)
    try {
      const res = await fetch(`/api/settings/permissions/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: updated.join(',') }),
      })
      if (res.ok) {
        toast.success(`Hak akses ${crew.userName} berhasil diperbarui`)
      } else {
        // Revert on failure
        setPermissions((prev) =>
          prev.map((p) =>
            p.userId === userId ? { ...p, pages: crew.pages } : p
          )
        )
        toast.error('Gagal memperbarui hak akses')
      }
    } catch {
      setPermissions((prev) =>
        prev.map((p) =>
          p.userId === userId ? { ...p, pages: crew.pages } : p
        )
      )
      toast.error('Gagal memperbarui hak akses')
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-5 w-36 bg-zinc-800" />
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-12 bg-zinc-800 rounded-lg" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardContent className="p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Hak Akses Crew</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Kelola halaman yang dapat diakses oleh setiap crew</p>
        </div>

        {permissions.length === 0 ? (
          <div className="py-8 text-center">
            <Users className="h-10 w-10 text-zinc-700 mx-auto mb-2" />
            <p className="text-sm text-zinc-500">Belum ada crew</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">Crew akan muncul setelah terdaftar di outlet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {permissions.map((crew) => {
              const crewPages = crew.pages.split(',').filter(Boolean)
              return (
                <div
                  key={crew.userId}
                  className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-3 space-y-2"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                      <Users className="h-4 w-4 text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-200">{crew.userName}</p>
                      <p className="text-[11px] text-zinc-500">{crew.userEmail}</p>
                    </div>
                    {savingId === crew.userId && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {AVAILABLE_PAGES.map((page) => {
                      const isChecked = crewPages.includes(page.key)
                      return (
                        <label
                          key={page.key}
                          className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer hover:text-zinc-200 transition-colors"
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => handleTogglePage(crew.userId, page.key, isChecked)}
                            className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                          />
                          {page.label}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ==================== TAB 4: LOYALTY PROGRAM ====================

function LoyaltyTab() {
  const { settings, loading, saving, saveSettings } = useSettings()
  const [edits, setEdits] = useState<Record<string, string | boolean> | null>(null)

  const loyaltyEnabled = edits?.loyaltyEnabled ?? settings?.loyaltyEnabled ?? true
  const pointsPerAmount = edits?.pointsPerAmount ?? (settings ? String(settings.loyaltyPointsPerAmount) : '10000')
  const pointValue = edits?.pointValue ?? (settings ? String(settings.loyaltyPointValue) : '100')
  const dirty = edits !== null

  const handleChange = (key: string, value: string | boolean) => {
    setEdits((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!settings) {
      toast.error('Pengaturan belum dimuat, silakan tunggu')
      return
    }
    const ok = await saveSettings({
      loyaltyEnabled: loyaltyEnabled as boolean,
      loyaltyPointsPerAmount: Number(pointsPerAmount),
      loyaltyPointValue: Number(pointValue),
    })
    if (ok) setEdits(null)
  }

  // Calculate example
  const ppa = Number(pointsPerAmount) || 10000
  const pv = Number(pointValue) || 100
  const exampleSpend = 50000
  const examplePoints = Math.floor(exampleSpend / ppa)
  const exampleDiscount = examplePoints * pv

  if (loading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-5 w-36 bg-zinc-800" />
          <Skeleton className="h-9 bg-zinc-800" />
          <Skeleton className="h-9 bg-zinc-800" />
          <Skeleton className="h-9 bg-zinc-800" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardContent className="p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Program Loyalti</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Konfigurasi poin loyalitas pelanggan</p>
        </div>

        {/* Enable toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-zinc-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Star className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-200">Aktifkan Program Loyalti</p>
              <p className="text-[11px] text-zinc-500">Pelanggan mendapat poin dari setiap transaksi</p>
            </div>
          </div>
          <Switch
            checked={loyaltyEnabled}
            onCheckedChange={(v) => handleChange('loyaltyEnabled', v)}
            className="data-[state=checked]:bg-amber-500"
          />
        </div>

        {loyaltyEnabled && (
          <>
            <Separator className="bg-zinc-800" />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="points-per-amount" className="text-xs text-zinc-300">
                  Setiap Rp X = 1 poin
                </Label>
                <Input
                  id="points-per-amount"
                  type="number"
                  min="1"
                  value={pointsPerAmount}
                  onChange={(e) => handleChange('pointsPerAmount', e.target.value)}
                  placeholder="10000"
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="point-value" className="text-xs text-zinc-300">
                  1 poin = Rp X diskon
                </Label>
                <Input
                  id="point-value"
                  type="number"
                  min="1"
                  value={pointValue}
                  onChange={(e) => handleChange('pointValue', e.target.value)}
                  placeholder="100"
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
                />
              </div>
            </div>

            {/* Example formula */}
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-[11px] font-medium text-amber-400 uppercase tracking-wider mb-1.5">Contoh Perhitungan</p>
              <p className="text-xs text-zinc-300">
                Belanja <span className="font-semibold text-amber-300">{formatCurrency(exampleSpend)}</span> ={' '}
                <span className="font-semibold text-amber-300">{examplePoints} poin</span> ={' '}
                <span className="font-semibold text-amber-300">{formatCurrency(exampleDiscount)} diskon</span>
              </p>
            </div>
          </>
        )}

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="bg-emerald-500 hover:bg-emerald-600 text-white h-9 text-xs"
          >
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            Simpan
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ==================== TAB 5: PROMO / DISKON ====================

function PromoTab() {
  const [promos, setPromos] = useState<Promo[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editPromo, setEditPromo] = useState<Promo | null>(null)
  const [formData, setFormData] = useState<PromoFormData>(DEFAULT_PROMO_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchPromos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings/promos')
      if (res.ok) {
        const data = await res.json()
        setPromos(data.promos || [])
      } else {
        toast.error('Gagal memuat promo')
      }
    } catch {
      toast.error('Gagal memuat promo')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPromos()
  }, [fetchPromos])

  const openCreate = () => {
    setEditPromo(null)
    setFormData(DEFAULT_PROMO_FORM)
    setDialogOpen(true)
  }

  const openEdit = (promo: Promo) => {
    setEditPromo(promo)
    setFormData({
      name: promo.name,
      type: promo.type,
      value: String(promo.value),
      minPurchase: promo.minPurchase ? String(promo.minPurchase) : '',
      maxDiscount: promo.maxDiscount ? String(promo.maxDiscount) : '',
      active: promo.active,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.value) {
      toast.error('Nama dan nilai diskon wajib diisi')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: formData.name,
        type: formData.type,
        value: Number(formData.value),
        minPurchase: formData.minPurchase ? Number(formData.minPurchase) : null,
        maxDiscount: formData.type === 'PERCENTAGE' && formData.maxDiscount ? Number(formData.maxDiscount) : null,
        active: formData.active,
      }
      const url = editPromo ? `/api/settings/promos/${editPromo.id}` : '/api/settings/promos'
      const method = editPromo ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        toast.success(editPromo ? 'Promo berhasil diperbarui' : 'Promo berhasil ditambahkan')
        setDialogOpen(false)
        fetchPromos()
      } else {
        toast.error('Gagal menyimpan promo')
      }
    } catch {
      toast.error('Gagal menyimpan promo')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/settings/promos/${deleteId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Promo berhasil dihapus')
        fetchPromos()
      } else {
        toast.error('Gagal menghapus promo')
      }
    } catch {
      toast.error('Gagal menghapus promo')
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Promo / Diskon</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Kelola promo dan diskon untuk pelanggan</p>
          </div>
          <Button
            onClick={openCreate}
            className="bg-emerald-500 hover:bg-emerald-600 text-white h-8 text-xs"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Tambah Promo
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 bg-zinc-800 rounded" />
            ))}
          </div>
        ) : promos.length === 0 ? (
          <div className="py-8 text-center">
            <Tag className="h-10 w-10 text-zinc-700 mx-auto mb-2" />
            <p className="text-sm text-zinc-500">Belum ada promo</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">Tambahkan promo untuk menarik pelanggan</p>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-800 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-500 text-[11px] font-medium h-8">Nama</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium h-8">Tipe</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium h-8 text-right">Nilai</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium h-8 text-right">Min. Belanja</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium h-8 text-right">Maks Diskon</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium h-8 text-center">Status</TableHead>
                  <TableHead className="text-zinc-500 text-[11px] font-medium h-8 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promos.map((promo) => (
                  <TableRow key={promo.id} className="border-zinc-800 hover:bg-zinc-800/50">
                    <TableCell className="text-xs text-zinc-200 font-medium py-2">{promo.name}</TableCell>
                    <TableCell className="py-2">
                      <Badge
                        variant="outline"
                        className={`text-[11px] ${
                          promo.type === 'PERCENTAGE'
                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        {promo.type === 'PERCENTAGE' ? 'Persentase' : 'Nominal'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-zinc-200 text-right py-2">
                      {promo.type === 'PERCENTAGE' ? `${promo.value}%` : formatCurrency(promo.value)}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-400 text-right py-2">
                      {promo.minPurchase ? formatCurrency(promo.minPurchase) : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-400 text-right py-2">
                      {promo.maxDiscount ? formatCurrency(promo.maxDiscount) : '-'}
                    </TableCell>
                    <TableCell className="text-center py-2">
                      <Badge
                        className={`text-[11px] ${
                          promo.active
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                        }`}
                      >
                        {promo.active ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                          onClick={() => openEdit(promo)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                          onClick={() => setDeleteId(promo.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Promo Form Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="bg-zinc-900 border-zinc-800 p-4">
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold text-zinc-100">
                {editPromo ? 'Edit Promo' : 'Tambah Promo Baru'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-1">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300">Nama Promo</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Contoh: Diskon Akhir Tahun"
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300">Tipe Diskon</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData((p) => ({ ...p, type: v }))}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100 w-full h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="PERCENTAGE">Persentase (%)</SelectItem>
                    <SelectItem value="NOMINAL">Nominal (Rp)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300">
                  Nilai Diskon {formData.type === 'PERCENTAGE' ? '(%)' : '(Rp)'}
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.value}
                  onChange={(e) => setFormData((p) => ({ ...p, value: e.target.value }))}
                  placeholder={formData.type === 'PERCENTAGE' ? '10' : '50000'}
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-300">Minimum Pembayaran (opsional)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.minPurchase}
                  onChange={(e) => setFormData((p) => ({ ...p, minPurchase: e.target.value }))}
                  placeholder="100000"
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
                />
              </div>
              {formData.type === 'PERCENTAGE' && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-300">Maks Diskon (opsional)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.maxDiscount}
                    onChange={(e) => setFormData((p) => ({ ...p, maxDiscount: e.target.value }))}
                    placeholder="50000"
                    className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
                  />
                </div>
              )}
              <div className="flex items-center gap-2.5 pt-1">
                <Switch
                  checked={formData.active}
                  onCheckedChange={(v) => setFormData((p) => ({ ...p, active: v }))}
                  className="data-[state=checked]:bg-emerald-500"
                />
                <Label className="text-xs text-zinc-300">Promo aktif</Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 h-8 text-xs"
              >
                Batal
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !formData.name || !formData.value}
                className="bg-emerald-500 hover:bg-emerald-600 text-white h-8 text-xs"
              >
                {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {editPromo ? 'Perbarui' : 'Tambah'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent className="bg-zinc-900 border-zinc-800">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-sm font-semibold text-zinc-100">Hapus Promo</AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-zinc-400">
                Apakah Anda yakin ingin menghapus promo ini? Tindakan ini tidak dapat dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 h-8 text-xs">
                Batal
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-500 hover:bg-red-600 text-white h-8 text-xs"
              >
                {deleting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}

// ==================== TAB 6: THEME & RECEIPT ====================

function ThemeReceiptTab() {
  const { settings, loading, saving, saveSettings } = useSettings()
  const [edits, setEdits] = useState<Record<string, string> | null>(null)

  const themeColor = edits?.themeColor ?? settings?.themePrimaryColor ?? 'emerald'
  const receiptBusinessName = edits?.receiptBusinessName ?? settings?.receiptBusinessName ?? ''
  const receiptAddress = edits?.receiptAddress ?? settings?.receiptAddress ?? ''
  const receiptPhone = edits?.receiptPhone ?? settings?.receiptPhone ?? ''
  const receiptFooter = edits?.receiptFooter ?? settings?.receiptFooter ?? ''
  const receiptLogo = edits?.receiptLogo ?? settings?.receiptLogo ?? ''
  const dirty = edits !== null

  const handleChange = (key: string, value: string) => {
    setEdits((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!settings) return
    const ok = await saveSettings({
      themePrimaryColor: themeColor,
      receiptBusinessName,
      receiptAddress,
      receiptPhone,
      receiptFooter,
      receiptLogo,
    })
    if (ok) setEdits(null)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-5 w-36 bg-zinc-800" />
            <Skeleton className="h-9 bg-zinc-800" />
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-5 w-36 bg-zinc-800" />
            <Skeleton className="h-9 bg-zinc-800" />
            <Skeleton className="h-9 bg-zinc-800" />
            <Skeleton className="h-9 bg-zinc-800" />
            <Skeleton className="h-9 bg-zinc-800" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Theme Section */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Tema</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Kustomisasi tampilan aplikasi</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-300">Warna tema utama</Label>
            <div className="flex items-center gap-2.5 flex-wrap">
              {THEME_COLORS.map((color) => {
                const isSelected = themeColor === color.name
                return (
                  <button
                    key={color.name}
                    onClick={() => handleChange('themeColor', color.name)}
                    className={`relative w-8 h-8 rounded-full ${color.classes} flex items-center justify-center transition-colors ${
                      isSelected ? 'ring-2 ring-offset-2 ring-offset-zinc-900 ring-white/50 scale-110' : 'hover:scale-105'
                    }`}
                    title={color.label}
                  >
                    {isSelected && <Check className="h-4 w-4 text-white" />}
                  </button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receipt Section */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Pengaturan Struk</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Informasi yang ditampilkan pada struk belanja</p>
          </div>

          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="receipt-name" className="text-xs text-zinc-300">Nama Usaha</Label>
              <Input
                id="receipt-name"
                value={receiptBusinessName}
                onChange={(e) => handleChange('receiptBusinessName', e.target.value)}
                placeholder="Masukkan nama usaha"
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="receipt-address" className="text-xs text-zinc-300">Alamat</Label>
              <Textarea
                id="receipt-address"
                value={receiptAddress}
                onChange={(e) => handleChange('receiptAddress', e.target.value)}
                placeholder="Masukkan alamat usaha"
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 text-sm"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="receipt-phone" className="text-xs text-zinc-300">Telepon</Label>
                <Input
                  id="receipt-phone"
                  value={receiptPhone}
                  onChange={(e) => handleChange('receiptPhone', e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="receipt-footer" className="text-xs text-zinc-300">Pesan Footer</Label>
                <Input
                  id="receipt-footer"
                  value={receiptFooter}
                  onChange={(e) => handleChange('receiptFooter', e.target.value)}
                  placeholder="Terima kasih atas kunjungan Anda!"
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="receipt-logo" className="text-xs text-zinc-300">Logo URL</Label>
              <Input
                id="receipt-logo"
                value={receiptLogo}
                onChange={(e) => handleChange('receiptLogo', e.target.value)}
                placeholder="https://example.com/logo.png"
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
              />
              <p className="text-[11px] text-zinc-500">Masukkan URL gambar logo</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receipt Preview */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-4 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Pratinjau Struk</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Tampilan struk yang akan dicetak</p>
          </div>

          <div className="flex justify-center">
            <div className="w-64 bg-white text-zinc-900 rounded-lg p-4 shadow-lg font-mono text-[11px] space-y-1.5">
              {/* Header */}
              <div className="text-center space-y-0.5">
                <p className="font-bold text-xs text-zinc-900">
                  {receiptBusinessName || 'Nama Usaha'}
                </p>
                <p className="text-zinc-600 text-[10px] whitespace-pre-line">
                  {receiptAddress || 'Alamat usaha'}
                </p>
                <p className="text-zinc-600 text-[10px]">
                  {receiptPhone || 'Telp: -'}
                </p>
              </div>

              {/* Dashed line */}
              <div className="border-t border-dashed border-zinc-400" />

              {/* Sample items */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-zinc-700">Nasi Goreng x2</span>
                  <span className="text-zinc-900">Rp30.000</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-zinc-700">Es Teh Manis x2</span>
                  <span className="text-zinc-900">Rp10.000</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-zinc-700">Ayam Bakar x1</span>
                  <span className="text-zinc-900">Rp25.000</span>
                </div>
              </div>

              {/* Dashed line */}
              <div className="border-t border-dashed border-zinc-400" />

              {/* Total */}
              <div className="flex justify-between font-bold text-[11px]">
                <span>TOTAL</span>
                <span>Rp65.000</span>
              </div>
              <div className="flex justify-between text-[10px] text-zinc-600">
                <span>Tunai</span>
                <span>Rp100.000</span>
              </div>
              <div className="flex justify-between text-[10px] text-zinc-600">
                <span>Kembalian</span>
                <span>Rp35.000</span>
              </div>

              {/* Dashed line */}
              <div className="border-t border-dashed border-zinc-400" />

              {/* Footer */}
              <p className="text-center text-[10px] text-zinc-600">
                {receiptFooter || 'Terima kasih atas kunjungan Anda!'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="bg-emerald-500 hover:bg-emerald-600 text-white h-9 text-xs"
        >
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
          Simpan Semua
        </Button>
      </div>
    </div>
  )
}

// ==================== TAB 7: TELEGRAM NOTIFICATION ====================

function TelegramTab() {
  const { settings, loading, saving, saveSettings } = useSettings()
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; botName?: string } | null>(null)
  const [dirty, setDirty] = useState(false)

  const isConnected = !!settings?.telegramChatId

  useEffect(() => {
    if (settings) {
      setChatId(settings.telegramChatId || '')
      setBotToken(settings.telegramBotToken && settings.telegramBotToken !== '••••••' ? '' : '')
    }
  }, [settings])

  const handleTestConnection = async () => {
    if (!botToken) {
      toast.error('Bot Token wajib diisi untuk test koneksi')
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/telegram/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          botToken,
          chatId: chatId || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setTestResult({
          ok: true,
          message: data.message || 'Koneksi berhasil',
          botName: data.botInfo?.username ? `@${data.botInfo.username}` : data.botInfo?.name,
        })
        toast.success('Koneksi bot berhasil!')
      } else {
        setTestResult({ ok: false, message: data.error || 'Gagal terhubung' })
        toast.error(data.error || 'Gagal terhubung ke Telegram')
      }
    } catch {
      setTestResult({ ok: false, message: 'Gagal terhubung — periksa koneksi internet' })
      toast.error('Gagal terhubung — periksa koneksi internet')
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    const ok = await saveSettings({
      telegramBotToken: botToken || null,
      telegramChatId: chatId || null,
      notifyOnTransaction: settings?.notifyOnTransaction ?? true,
      notifyOnCustomer: settings?.notifyOnCustomer ?? true,
      notifyDailyReport: settings?.notifyDailyReport ?? true,
      notifyWeeklyReport: settings?.notifyWeeklyReport ?? false,
      notifyMonthlyReport: settings?.notifyMonthlyReport ?? true,
    })
    if (ok) {
      setDirty(false)
      setBotToken('')
    }
  }

  const handleToggle = (key: keyof Pick<SettingsData, 'notifyOnTransaction' | 'notifyOnCustomer' | 'notifyDailyReport' | 'notifyWeeklyReport' | 'notifyMonthlyReport'>, value: boolean) => {
    if (settings) {
      setSettings({ ...settings, [key]: value })
      setDirty(true)
    }
  }

  const handleDisconnect = async () => {
    try {
      const res = await fetch('/api/telegram/setup', { method: 'DELETE' })
      if (res.ok) {
        toast.success('Telegram terputus')
        setChatId('')
        setBotToken('')
        if (settings) {
          setSettings({
            ...settings,
            telegramChatId: null,
            telegramBotToken: null,
          })
        }
        setDirty(false)
      } else {
        toast.error('Gagal memutuskan koneksi')
      }
    } catch {
      toast.error('Gagal memutuskan koneksi')
    }
  }

  if (loading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-5 w-36 bg-zinc-800" />
          <Skeleton className="h-9 bg-zinc-800" />
          <Skeleton className="h-9 bg-zinc-800" />
          <Skeleton className="h-12 bg-zinc-800 rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  const notificationToggles = [
    { key: 'notifyOnTransaction' as const, label: 'Transaksi Baru', desc: 'Setiap ada transaksi masuk' },
    { key: 'notifyOnCustomer' as const, label: 'Customer Baru', desc: 'Saat ada pelanggan terdaftar' },
    { key: 'notifyDailyReport' as const, label: 'Laporan Harian', desc: 'Ringkasan pendapatan harian' },
    { key: 'notifyWeeklyReport' as const, label: 'Laporan Mingguan', desc: 'Ringkasan pendapatan mingguan' },
    { key: 'notifyMonthlyReport' as const, label: 'Laporan Bulanan', desc: 'Ringkasan pendapatan bulanan' },
  ]

  return (
    <div className="space-y-4">
      {/* Connection Card */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Koneksi Telegram</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Hubungkan bot untuk notifikasi otomatis</p>
            </div>
            <Badge
              className={`text-[11px] ${
                isConnected
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-500'
              }`}
            >
              {isConnected ? (
                <span className="flex items-center gap-1"><Wifi className="h-3 w-3" /> Terhubung</span>
              ) : (
                <span className="flex items-center gap-1"><WifiOff className="h-3 w-3" /> Tidak Terhubung</span>
              )}
            </Badge>
          </div>

          <div className="space-y-3">
            {/* Bot Token */}
            <div className="space-y-1.5">
              <Label htmlFor="bot-token" className="text-xs text-zinc-300">Bot Token</Label>
              <div className="relative">
                <Input
                  id="bot-token"
                  type={showToken ? 'text' : 'password'}
                  value={botToken}
                  onChange={(e) => { setBotToken(e.target.value); setDirty(true) }}
                  placeholder={settings?.telegramBotToken === '••••••' ? 'Token tersimpan (kosongkan untuk mengganti)' : 'Masukkan token dari @BotFather'}
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Chat ID */}
            <div className="space-y-1.5">
              <Label htmlFor="chat-id" className="text-xs text-zinc-300">Chat ID</Label>
              <Input
                id="chat-id"
                value={chatId}
                onChange={(e) => { setChatId(e.target.value); setDirty(true) }}
                placeholder="Contoh: 123456789"
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
              />
            </div>

            {/* Test Connection Button */}
            <Button
              onClick={handleTestConnection}
              disabled={testing || !botToken}
              variant="outline"
              className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 h-9 text-xs"
            >
              {testing ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-3.5 w-3.5" />
              )}
              Test Koneksi
            </Button>

            {/* Test Result */}
            {testResult && (
              <div className={`rounded-lg border p-3 ${
                testResult.ok
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : 'bg-red-500/5 border-red-500/20'
              }`}>
                <div className="flex items-center gap-1.5">
                  {testResult.ok ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Unlink2 className="h-4 w-4 text-red-400" />
                  )}
                  <p className={`text-xs font-medium ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {testResult.message}
                  </p>
                </div>
                {testResult.botName && (
                  <p className="text-[11px] text-zinc-400 mt-1 ml-5.5">Bot: {testResult.botName}</p>
                )}
              </div>
            )}

            {/* Status info */}
            {isConnected && (
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <Link2 className="h-3.5 w-3.5" />
                <span>Chat ID: {settings?.telegramChatId}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            {isConnected && (
              <Button
                onClick={handleDisconnect}
                variant="outline"
                className="border-red-500/20 text-red-400 hover:bg-red-500/10 h-9 text-xs"
              >
                <Unlink2 className="mr-1.5 h-3.5 w-3.5" />
                Putuskan
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="bg-emerald-500 hover:bg-emerald-600 text-white h-9 text-xs"
            >
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Simpan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification Toggles */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Jenis Notifikasi</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Pilih event yang ingin dikirim via Telegram</p>
          </div>

          <div className="space-y-2">
            {notificationToggles.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-800 bg-zinc-800/30"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-200">{item.label}</p>
                  <p className="text-[11px] text-zinc-500">{item.desc}</p>
                </div>
                <Switch
                  checked={!!settings?.[item.key]}
                  onCheckedChange={(v) => handleToggle(item.key, v)}
                  className="data-[state=checked]:bg-emerald-500"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="bg-emerald-500 hover:bg-emerald-600 text-white h-9 text-xs"
            >
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Simpan Notifikasi
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== TAB 8: ACCOUNT SECURITY ====================

function AccountTab() {
  const { data: session } = useSession()

  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [changingEmail, setChangingEmail] = useState(false)

  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [changingPwd, setChangingPwd] = useState(false)

  const handleChangeEmail = async () => {
    if (!newEmail || !emailPassword) {
      toast.error('Email baru dan password wajib diisi')
      return
    }
    if (!newEmail.includes('@')) {
      toast.error('Format email tidak valid')
      return
    }
    setChangingEmail(true)
    try {
      const res = await fetch('/api/auth/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, currentPassword: emailPassword }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Email berhasil diperbarui')
        setNewEmail('')
        setEmailPassword('')
      } else {
        toast.error(data.error || 'Gagal mengganti email')
      }
    } catch {
      toast.error('Gagal mengganti email')
    } finally {
      setChangingEmail(false)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd || !confirmPwd) {
      toast.error('Semua field wajib diisi')
      return
    }
    if (newPwd.length < 6) {
      toast.error('Password baru minimal 6 karakter')
      return
    }
    if (newPwd !== confirmPwd) {
      toast.error('Konfirmasi password tidak cocok')
      return
    }
    setChangingPwd(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Password berhasil diperbarui')
        setCurrentPwd('')
        setNewPwd('')
        setConfirmPwd('')
      } else {
        toast.error(data.error || 'Gagal mengganti password')
      }
    } catch {
      toast.error('Gagal mengganti password')
    } finally {
      setChangingPwd(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Current Account Info */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-4 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Informasi Akun</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Detail akun yang sedang digunakan</p>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Nama</span>
              <span className="text-xs font-medium text-zinc-200">{session?.user?.name || '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Email</span>
              <span className="text-xs font-medium text-zinc-200">{session?.user?.email || '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Peran</span>
              <Badge
                variant="outline"
                className={`text-[11px] px-1.5 py-0 ${
                  session?.user?.role === 'OWNER'
                    ? 'bg-amber-500/10 border-amber-500/15 text-amber-400'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                }`}
              >
                {session?.user?.role === 'OWNER' ? 'Owner' : 'Crew'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Email */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Ganti Email</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Ubah email akun Anda</p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-email" className="text-xs text-zinc-300">Email Baru</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@contoh.com"
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-password" className="text-xs text-zinc-300">Konfirmasi Password</Label>
              <Input
                id="email-password"
                type="password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                placeholder="Masukkan password saat ini"
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
              />
            </div>
          </div>

          <Button
            onClick={handleChangeEmail}
            disabled={changingEmail || !newEmail || !emailPassword}
            className="bg-emerald-500 hover:bg-emerald-600 text-white h-9 text-xs"
          >
            {changingEmail ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            Ganti Email
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Ganti Password</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Ubah password akun Anda</p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="current-password" className="text-xs text-zinc-300">Password Saat Ini</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                placeholder="Masukkan password saat ini"
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs text-zinc-300">Password Baru</Label>
              <Input
                id="new-password"
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-xs text-zinc-300">Konfirmasi Password Baru</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="Ulangi password baru"
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-9 text-sm"
              />
            </div>
          </div>

          <Button
            onClick={handleChangePassword}
            disabled={changingPwd || !currentPwd || !newPwd || !confirmPwd || newPwd !== confirmPwd || newPwd.length < 6}
            className="bg-emerald-500 hover:bg-emerald-600 text-white h-9 text-xs"
          >
            {changingPwd ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <KeyRound className="mr-1.5 h-3.5 w-3.5" />
            )}
            Ganti Password
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== TAB 9: MULTI-OUTLET (PLACEHOLDER) ====================

function MultiOutletTab() {
  const { settings, loading } = useSettings()

  if (loading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-5 w-36 bg-zinc-800" />
          <Skeleton className="h-20 bg-zinc-800 rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Outlet Cabang</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Kelola beberapa outlet dalam satu akun</p>
          </div>

          {/* Current outlet info */}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-400" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-emerald-400">Outlet Utama (Aktif)</p>
                <p className="text-[11px] text-zinc-400">{settings?.outlet?.name || '-'}</p>
              </div>
            </div>
          </div>

          {/* Placeholder for future outlets */}
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-dashed border-zinc-800 p-4 flex items-center justify-center opacity-40"
              >
                <div className="text-center">
                  <Building2 className="h-5 w-5 text-zinc-600 mx-auto mb-1" />
                  <p className="text-xs text-zinc-600">Outlet cabang {i + 1}</p>
                  <p className="text-[10px] text-zinc-700">Segera hadir</p>
                </div>
              </div>
            ))}
          </div>

          <Button
            disabled
            className="w-full border-zinc-700 text-zinc-500 bg-zinc-800/50 h-9 text-xs"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Tambah Cabang
          </Button>

          <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-3">
            <p className="text-[11px] text-zinc-500 text-center">
              Multi-outlet tersedia untuk akun <span className="text-amber-400 font-medium">Enterprise</span>. Upgrade untuk mengakses fitur ini.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
