'use client'

import { SessionProvider, useSession } from 'next-auth/react'
import { usePageStore } from '@/hooks/use-page-store'
import { useSidebarStore } from '@/components/layout/sidebar'
import Sidebar from '@/components/layout/sidebar'
import AuthView from '@/components/auth/auth-view'
import DashboardPage from '@/components/pages/dashboard-page'
import ProductsPage from '@/components/pages/products-page'
import CustomersPage from '@/components/pages/customers-page'
import PosPage from '@/components/pages/pos-page'
import TransactionsPage from '@/components/pages/transactions-page'
import AuditLogPage from '@/components/pages/audit-log-page'
import CrewPage from '@/components/pages/crew-page'
import SettingsPage from '@/components/pages/settings-page'
import { Loader2 } from 'lucide-react'

function AppContent() {
  const { data: session, status } = useSession()
  const { currentPage } = usePageStore()
  const { collapsed } = useSidebarStore()

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
      </div>
    )
  }

  if (!session) {
    return <AuthView />
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
    <div className="min-h-screen bg-zinc-950">
      <Sidebar />
      <main
        className={`min-h-screen transition-all duration-300 ease-in-out ${
          collapsed ? 'md:ml-[68px]' : 'md:ml-64'
        }`}
      >
        <div className="pt-12 md:pt-0 px-2 sm:px-3 md:px-4 py-2 md:py-4 lg:px-5 lg:py-4">
          {renderPage()}
        </div>
      </main>
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
