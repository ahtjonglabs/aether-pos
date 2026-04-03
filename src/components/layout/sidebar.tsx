'use client'

import { useSession, signOut } from 'next-auth/react'
import { usePageStore, type PageType } from '@/hooks/use-page-store'
import { usePlan } from '@/hooks/use-plan'
import { getPlanBadgeClass } from '@/lib/plan-config'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  Receipt,
  ClipboardList,
  LogOut,
  Store,
  Menu,
  Settings,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useState } from 'react'

interface NavItem {
  label: string
  icon: React.ReactNode
  page: PageType
  shortLabel: string // for collapsed sidebar
}

const navItems: NavItem[] = [
  { label: 'Dashboard', shortLabel: 'Dash', icon: <LayoutDashboard className="h-[18px] w-[18px]" />, page: 'dashboard' },
  { label: 'Products', shortLabel: 'Prod', icon: <Package className="h-[18px] w-[18px]" />, page: 'products' },
  { label: 'Customers', shortLabel: 'Cust', icon: <Users className="h-[18px] w-[18px]" />, page: 'customers' },
  { label: 'POS', shortLabel: 'POS', icon: <ShoppingCart className="h-[18px] w-[18px]" />, page: 'pos' },
  { label: 'Transactions', shortLabel: 'Txn', icon: <Receipt className="h-[18px] w-[18px]" />, page: 'transactions' },
  { label: 'Audit Log', shortLabel: 'Log', icon: <ClipboardList className="h-[18px] w-[18px]" />, page: 'audit-log' },
  { label: 'Pengaturan', shortLabel: 'Set', icon: <Settings className="h-[18px] w-[18px]" />, page: 'settings' },
]

function SidebarContent({ collapsed, onNavigate, onToggleCollapse }: {
  collapsed?: boolean
  onNavigate?: () => void
  onToggleCollapse?: () => void
}) {
  const { data: session } = useSession()
  const { currentPage, setCurrentPage } = usePageStore()
  const { plan, isSuspended } = usePlan()

  const handleNav = (page: PageType) => {
    setCurrentPage(page)
    onNavigate?.()
  }

  const userInitials = session?.user?.name
    ? session.user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-800/60">
      {/* Logo */}
      <div className={`flex items-center ${collapsed ? 'justify-center px-2' : 'gap-2.5 px-4'} h-14 shrink-0`}>
        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
          <Store className="w-4 h-4 text-emerald-400" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-zinc-100 tracking-tight leading-none">Aether POS</h1>
            <p className="text-[9px] text-zinc-500 uppercase tracking-[0.12em] mt-0.5">Point of Sale</p>
          </div>
        )}
        {/* Collapse toggle — desktop only */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="ml-auto hidden lg:flex items-center justify-center w-6 h-6 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = currentPage === item.page
          return (
            <button
              key={item.page}
              onClick={() => handleNav(item.page)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-colors ${
                collapsed ? 'justify-center px-2 py-2' : 'px-2.5 py-2'
              } ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300'
              }`}
            >
              {item.icon}
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Suspended warning */}
      {isSuspended && (
        <div className={`mx-2 mb-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/15 ${collapsed ? 'hidden' : ''}`}>
          <div className="flex items-center gap-1.5 text-red-400">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[11px] font-semibold">Outlet Suspended</span>
          </div>
          <p className="text-[10px] text-red-400/60 mt-1 leading-tight">
            Akun dinonaktifkan oleh admin. Hubungi support.
          </p>
        </div>
      )}

      {/* User Info */}
      <div className={`shrink-0 border-t border-zinc-800/60 ${collapsed ? 'px-2' : 'px-3'} py-3`}>
        {!collapsed ? (
          <div className="flex items-center gap-2.5 mb-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-zinc-800 text-zinc-400 text-[10px] font-semibold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-zinc-300 truncate leading-tight">
                {session?.user?.name || 'User'}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <Badge
                  variant="outline"
                  className={`text-[9px] px-1 py-0 leading-4 ${
                    session?.user?.role === 'OWNER'
                      ? 'bg-amber-500/10 border-amber-500/15 text-amber-400'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                  }`}
                >
                  {session?.user?.role || 'CREW'}
                </Badge>
                {plan && (
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1 py-0 leading-4 ${getPlanBadgeClass(plan.type)}`}
                  >
                    {plan.label}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        ) : (
          <Avatar className="h-7 w-7 mx-auto mb-2">
            <AvatarFallback className="bg-zinc-800 text-zinc-400 text-[10px] font-semibold">
              {userInitials}
            </AvatarFallback>
          </Avatar>
        )}
        <Button
          variant="ghost"
          className={`w-full justify-${collapsed ? 'center' : 'start'} text-zinc-500 hover:text-red-400 hover:bg-red-500/10 h-8 text-xs gap-2`}
          onClick={() => signOut()}
        >
          <LogOut className="h-3.5 w-3.5" />
          {!collapsed && <span>Sign Out</span>}
        </Button>
      </div>
    </div>
  )
}

export default function Sidebar() {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <>
      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center gap-2.5 h-12 px-3 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800/60">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 h-8 w-8">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 bg-zinc-950 border-zinc-800/60">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-1.5">
          <Store className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-zinc-100">Aether POS</span>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col fixed top-0 left-0 h-full bg-zinc-950 border-r border-zinc-800/60 z-40 transition-all duration-150 ${
          collapsed ? 'w-[56px]' : 'w-52'
        }`}
      >
        <SidebarContent
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
        />
      </aside>
    </>
  )
}
