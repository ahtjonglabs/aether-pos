'use client'

import { useState } from 'react'
import { SessionProvider, useSession } from 'next-auth/react'
import { usePageStore } from '@/hooks/use-page-store'
import { useSidebarStore } from '@/components/layout/sidebar'
import Sidebar from '@/components/layout/sidebar'
import MobileBottomNav from '@/components/layout/mobile-bottom-nav'
import AuthView from '@/components/auth/auth-view'
import LandingPage from '@/components/pages/landing-page'
import DashboardPage from '@/components/pages/dashboard-page'
import ProductsPage from '@/components/pages/products-page'
import CustomersPage from '@/components/pages/customers-page'
import PosPage from '@/components/pages/pos-page'
import TransactionsPage from '@/components/pages/transactions-page'
import AuditLogPage from '@/components/pages/audit-log-page'
import CrewPage from '@/components/pages/crew-page'
import SettingsPage from '@/components/pages/settings-page'
import { Loader2 } from 'lucide-react'

type AuthScreen = 'landing' | 'auth'

function AppContent() {
  // Reduce session polling to every 5 minutes to prevent premature session expiry detection
  // during offline→online transitions (default is every 5s which is too aggressive)
  const { data: session, status } = useSession({
    refetchInterval: 5 * 60 * 1000, // Poll every 5 minutes instead of default 5s
    refetchOnWindowFocus: true,
  })
  const { currentPage } = usePageStore()
  const { collapsed } = useSidebarStore()

  // Track auth screen: landing (default) or auth (login/register form)
  const [authScreen, setAuthScreen] = useState<AuthScreen>('landing')

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
      </div>
    )
  }

  if (!session) {
    if (authScreen === 'landing') {
      return (
        <LandingPage
          onLogin={() => setAuthScreen('auth')}
          onRegister={() => setAuthScreen('auth')}
        />
      )
    }
    // Show auth view with a back-to-landing option
    return <AuthViewWithBack onBack={() => setAuthScreen('landing')} />
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />
      case 'products':
        return <ProductsPage />
      case 'customers':
        return <CustomersPage />
      case 'pos':
        return <PosPage />
      case 'transactions':
        return <TransactionsPage />
      case 'audit-log':
        return <AuditLogPage />
      case 'crew':
        return <CrewPage />
      case 'settings':
        return <SettingsPage />
      default:
        return <DashboardPage />
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 overflow-x-hidden">
      <Sidebar />
      <MobileBottomNav />
      <main
        className={`min-h-screen transition-all duration-300 ease-in-out overflow-x-hidden ${
          collapsed ? 'md:ml-[68px]' : 'md:ml-64'
        }`}
      >
        {/* Mobile: no top padding (no hamburger bar), bottom padding for nav */}
        {/* Desktop: no top padding, no bottom padding */}
        <div className="pb-20 md:pb-0 px-3 sm:px-4 md:py-4 lg:px-5 lg:py-4 max-w-full">
          {renderPage()}
        </div>
      </main>
    </div>
  )
}

// Wrapper that adds a "← Kembali" button to the AuthView
function AuthViewWithBack({ onBack }: { onBack: () => void }) {
  return (
    <div className="relative">
      <button
        onClick={onBack}
        className="fixed top-4 left-4 z-[60] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/80 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/80 transition-all duration-200 text-xs font-medium backdrop-blur-sm"
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Kembali
      </button>
      <AuthView />
    </div>
  )
}

export default function AppShell() {
  return (
    <SessionProvider>
      <AppContent />
    </SessionProvider>
  )
}
