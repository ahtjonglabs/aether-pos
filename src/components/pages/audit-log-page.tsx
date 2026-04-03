'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Pagination } from '@/components/shared/pagination'
import { Search, Download, X } from 'lucide-react'

interface AuditLog {
  id: string
  action: string
  entityType: string
  entityId?: string | null
  details?: string | null
  createdAt: string
  user?: {
    name: string
    email: string
  }
}

interface AuditLogListResponse {
  logs: AuditLog[]
  totalPages: number
}

const actionBadgeColors: Record<string, string> = {
  CREATE: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  RESTOCK: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
  SALE: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  ADJUSTMENT: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
  UPDATE: 'bg-zinc-500/10 border-zinc-500/20 text-zinc-300',
  DELETE: 'bg-red-500/10 border-red-500/20 text-red-400',
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [actionFilter, setActionFilter] = useState<string>('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (actionFilter !== 'ALL') params.set('action', actionFilter)
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      if (search) params.set('search', search)
      const res = await fetch(`/api/audit-logs?${params}`)
      if (res.ok) {
        const data: AuditLogListResponse = await res.json()
        setLogs(data.logs)
        setTotalPages(data.totalPages)
      } else {
        toast.error('Failed to load audit logs')
      }
    } catch {
      toast.error('Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [page, actionFilter, dateFrom, dateTo, search])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleFilter = () => {
    setSearch(searchInput)
    setPage(1)
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setSearch('')
    setPage(1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFilter()
    }
  }

  const handleExport = () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (actionFilter !== 'ALL') params.set('action', actionFilter)
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo) params.set('to', dateTo)
    window.open(`/api/audit-logs/export?${params}`, '_blank')
  }

  const parseDetails = (details: string | null) => {
    if (!details) return null
    try {
      return JSON.parse(details)
    } catch {
      return details
    }
  }

  const hasActiveFilters = search || actionFilter !== 'ALL' || dateFrom || dateTo

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Audit Log</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Track all system activities and changes</p>
        </div>
        <Button
          onClick={handleExport}
          variant="outline"
          className="h-9 sm:h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search box */}
        <div className="relative flex-1 min-w-0 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
          <Input
            type="text"
            placeholder="Cari SKU, invoice, tanggal..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-8 pr-8 bg-zinc-800 border-zinc-700 text-zinc-100 h-8 text-xs placeholder:text-zinc-500"
          />
          {searchInput && (
            <button
              onClick={handleClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Action filter */}
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-full sm:w-36 bg-zinc-800 border-zinc-700 text-zinc-100 h-8 text-xs">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700">
            <SelectItem value="ALL">All Actions</SelectItem>
            <SelectItem value="CREATE">Create</SelectItem>
            <SelectItem value="RESTOCK">Restock</SelectItem>
            <SelectItem value="SALE">Sale</SelectItem>
            <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
            <SelectItem value="UPDATE">Update</SelectItem>
            <SelectItem value="DELETE">Delete</SelectItem>
          </SelectContent>
        </Select>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-zinc-100 h-8 text-xs"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-zinc-100 h-8 text-xs"
          />
        </div>

        {/* Filter & Clear buttons */}
        <div className="flex items-center gap-1.5">
          <Button
            onClick={() => {
              setPage(1)
              fetchLogs()
            }}
            variant="outline"
            className="h-8 text-xs bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
          >
            <Search className="mr-1 h-3 w-3" />
            Filter
          </Button>
          {hasActiveFilters && (
            <Button
              onClick={() => {
                setActionFilter('ALL')
                setDateFrom('')
                setDateTo('')
                setSearchInput('')
                setSearch('')
                setPage(1)
              }}
              variant="ghost"
              className="h-8 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            >
              <X className="mr-1 h-3 w-3" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Active filter indicators */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5">
          {search && (
            <Badge variant="outline" className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[11px] gap-1 px-2 py-0.5">
              Search: &quot;{search}&quot;
              <button onClick={() => { setSearchInput(''); setSearch(''); setPage(1) }}>
                <X className="h-2.5 w-2.5 ml-0.5" />
              </button>
            </Badge>
          )}
          {actionFilter !== 'ALL' && (
            <Badge variant="outline" className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[11px] gap-1 px-2 py-0.5">
              Action: {actionFilter}
              <button onClick={() => { setActionFilter('ALL'); setPage(1) }}>
                <X className="h-2.5 w-2.5 ml-0.5" />
              </button>
            </Badge>
          )}
          {dateFrom && (
            <Badge variant="outline" className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[11px] gap-1 px-2 py-0.5">
              From: {dateFrom}
              <button onClick={() => { setDateFrom(''); setPage(1) }}>
                <X className="h-2.5 w-2.5 ml-0.5" />
              </button>
            </Badge>
          )}
          {dateTo && (
            <Badge variant="outline" className="bg-zinc-800 border-zinc-700 text-zinc-300 text-[11px] gap-1 px-2 py-0.5">
              To: {dateTo}
              <button onClick={() => { setDateTo(''); setPage(1) }}>
                <X className="h-2.5 w-2.5 ml-0.5" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 bg-zinc-900 rounded" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
          <Search className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-zinc-400">
            {hasActiveFilters ? 'No audit logs match your filters' : 'No audit logs found'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-800 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-500 text-[11px] font-medium h-8">Timestamp</TableHead>
                <TableHead className="text-zinc-500 text-[11px] font-medium h-8">User</TableHead>
                <TableHead className="text-zinc-500 text-[11px] font-medium h-8 text-center">Action</TableHead>
                <TableHead className="text-zinc-500 text-[11px] font-medium h-8">Entity</TableHead>
                <TableHead className="text-zinc-500 text-[11px] font-medium h-8">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const parsedDetails = parseDetails(log.details)
                const detailsText = typeof parsedDetails === 'string'
                  ? parsedDetails
                  : parsedDetails
                  ? JSON.stringify(parsedDetails)
                  : null

                return (
                  <TableRow key={log.id} className="border-zinc-800 hover:bg-zinc-800/50">
                    <TableCell className="text-xs text-zinc-400 whitespace-nowrap py-2">
                      {formatDate(log.createdAt)}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-200 py-2">
                      {log.user?.name || 'System'}
                    </TableCell>
                    <TableCell className="text-center py-2">
                      <Badge className={`text-[11px] ${actionBadgeColors[log.action] || 'bg-zinc-500/10 border-zinc-500/20 text-zinc-300'}`}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-zinc-300 py-2">
                      <span className="text-zinc-500 lowercase">{log.entityType}</span>
                    </TableCell>
                    <TableCell className="text-xs text-zinc-400 max-w-xs truncate py-2">
                      {detailsText || '-'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  )
}
