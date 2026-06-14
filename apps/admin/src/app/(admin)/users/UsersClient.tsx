'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import {
  Phone,
  Mail,
  ChevronRight,
  Smartphone,
  Download,
} from 'lucide-react'
import { FilterBar } from '@/components/ui/FilterBar'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { exportUsersCsv } from '@/app/actions/export-actions'
import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { adminCacheTags } from '@/lib/admin-cache-tags'

type UserRow = {
  id: string
  phone: string | null
  email: string | null
  fullName: string | null
  authMethod: string
  subscriptionStatus: string
  role: string
  suspendedAt: Date | null
  deletedAt: Date | null
  lastLoginAt: Date | null
  createdAt: Date
  _count: { profiles: number }
}

interface UsersClientProps {
  data: {
    users: UserRow[]
    total: number
    page: number
    pageSize: number
    totalPages: number
    sort: string
    order: 'asc' | 'desc'
  }
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'all', label: 'All' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'deleted', label: 'Deleted' },
]

function getUserStatus(user: UserRow): 'active' | 'suspended' | 'deleted' {
  if (user.deletedAt) return 'deleted'
  if (user.suspendedAt) return 'suspended'
  return 'active'
}

function formatDate(d: Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function AuthMethodBadge({ method }: { method: string }) {
  const isPhone = method === 'PHONE_OTP'
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
      {isPhone ? <Phone size={12} aria-hidden="true" /> : <Mail size={12} aria-hidden="true" />}
      {isPhone ? 'OTP' : 'Email'}
    </span>
  )
}

function SubBadge({ status }: { status: string }) {
  if (status === 'PRO') return <Badge variant="success" size="sm">Pro</Badge>
  if (status === 'LAPSED') return <Badge variant="warning" size="sm">Lapsed</Badge>
  return <Badge variant="neutral" size="sm">Free</Badge>
}

const COLUMNS: Column<UserRow>[] = [
  {
    key: 'fullName',
    header: 'Name',
    render: (row) => (
      <span className="font-medium text-[var(--color-text-primary)]">
        {row.fullName ?? '—'}
      </span>
    ),
  },
  {
    key: 'contact',
    header: 'Contact',
    render: (row) => (
      <div className="space-y-0.5">
        {row.email && (
          <div className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
            <Mail size={11} aria-hidden="true" className="shrink-0" />
            <span className="truncate max-w-[160px]">{row.email}</span>
          </div>
        )}
        {row.phone && (
          <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
            <Smartphone size={11} aria-hidden="true" className="shrink-0" />
            <span>{row.phone}</span>
          </div>
        )}
      </div>
    ),
  },
  {
    key: 'authMethod',
    header: 'Auth',
    render: (row) => <AuthMethodBadge method={row.authMethod} />,
  },
  {
    key: 'subscriptionStatus',
    header: 'Subscription',
    render: (row) => <SubBadge status={row.subscriptionStatus} />,
  },
  {
    key: 'profiles',
    header: 'Profiles',
    render: (row) => (
      <span className="text-sm tabular-nums text-[var(--color-text-secondary)]">
        {row._count.profiles}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => {
      const status = getUserStatus(row)
      if (status === 'active') return <Badge variant="success" size="sm">Active</Badge>
      if (status === 'suspended') return <Badge variant="danger" size="sm">Suspended</Badge>
      return <Badge variant="neutral" size="sm">Deleted</Badge>
    },
  },
  {
    key: 'lastLoginAt',
    header: 'Last Login',
    sortable: true,
    render: (row) => (
      <span className="text-sm tabular-nums text-[var(--color-text-muted)]">
        {formatDate(row.lastLoginAt)}
      </span>
    ),
  },
  {
    key: 'createdAt',
    header: 'Created',
    sortable: true,
    render: (row) => (
      <span className="text-sm tabular-nums text-[var(--color-text-muted)]">
        {formatDate(row.createdAt)}
      </span>
    ),
  },
  {
    key: 'action',
    header: '',
    render: () => (
      <ChevronRight size={16} aria-hidden="true" className="text-[var(--color-text-muted)]" />
    ),
    width: '40px',
  },
]

export function UsersClient({ data }: UsersClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [exporting, setExporting] = useState(false)

  const currentSearch = searchParams.get('search') ?? ''
  const currentStatus = searchParams.get('status') ?? 'active'
  const currentPage = data.page
  const currentPageSize = data.pageSize
  const currentSort = data.sort
  const currentOrder = data.order

  const updateParams = useCallback(
    (updates: Record<string, string | number>) => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(updates).forEach(([k, v]) => {
        if (v === '' || v === undefined) {
          params.delete(k)
        } else {
          params.set(k, String(v))
        }
      })
      // Reset page when filter changes
      if (!('page' in updates)) params.set('page', '1')
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`)
      })
    },
    [router, pathname, searchParams]
  )

  function handleSearch(value: string) {
    updateParams({ search: value })
  }

  function handleStatusChange(value: string) {
    updateParams({ status: value })
  }

  function handlePageChange(page: number) {
    updateParams({ page })
  }

  function handlePageSizeChange(pageSize: number) {
    updateParams({ pageSize, page: 1 })
  }

  function handleSortChange(key: string, order: 'asc' | 'desc') {
    updateParams({ sort: key, order, page: 1 })
  }

  function handleRowClick(row: UserRow) {
    router.push(`/users/${row.id}`)
  }

  async function handleExport() {
    setExporting(true)
    try {
      const csv = await exportUsersCsv()
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `users-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 page-enter">
      <AdminPageHeader
        title="Users"
        description={`${data.total.toLocaleString()} total users`}
        tags={[adminCacheTags.users]}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExport}
            loading={exporting}
            disabled={exporting}
          >
            <Download size={15} />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        }
      />

      {/* Filters */}
      <FilterBar
        searchValue={currentSearch}
        onSearchChange={handleSearch}
        searchPlaceholder="Search by name, email, or phone…"
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: STATUS_OPTIONS,
            value: currentStatus,
            onChange: handleStatusChange,
          },
        ]}
      />

      {/* Table */}
      <DataTable
        columns={COLUMNS}
        data={data.users as unknown as UserRow[]}
        emptyMessage="No users match your filters."
        onRowClick={handleRowClick}
        keyExtractor={(row) => row.id}
        sortKey={currentSort}
        sortOrder={currentOrder}
        onSortChange={handleSortChange}
      />

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={data.totalPages}
        pageSize={currentPageSize}
        total={data.total}
        itemLabel="user"
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  )
}
