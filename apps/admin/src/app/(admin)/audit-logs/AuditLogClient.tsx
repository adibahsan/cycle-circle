'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { FilterBar } from '@/components/ui/FilterBar'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { adminCacheTags } from '@/lib/admin-cache-tags'

type AuditLogRow = {
  id: string
  adminId: string
  action: string
  targetType: string
  targetId: string
  metadata: unknown
  createdAt: Date
  admin: { fullName: string | null; email: string | null } | null
}

interface AuditLogClientProps {
  data: {
    logs: AuditLogRow[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'SUSPEND_USER', label: 'Suspend User' },
  { value: 'REACTIVATE_USER', label: 'Reactivate User' },
  { value: 'SOFT_DELETE_USER', label: 'Delete User' },
  { value: 'GRANT_PRO', label: 'Grant Pro' },
  { value: 'REVOKE_PRO', label: 'Revoke Pro' },
  { value: 'CREATE_ARTICLE', label: 'Create Article' },
  { value: 'UPDATE_ARTICLE', label: 'Update Article' },
  { value: 'DELETE_ARTICLE', label: 'Delete Article' },
  { value: 'SEND_SMS_BROADCAST', label: 'Send SMS Broadcast' },
]

const TARGET_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'USER', label: 'User' },
  { value: 'ARTICLE', label: 'Article' },
  { value: 'SUBSCRIPTION', label: 'Subscription' },
  { value: 'SMS_BROADCAST', label: 'SMS Broadcast' },
]

const ACTION_VARIANT_MAP: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  SUSPEND_USER: 'danger',
  SOFT_DELETE_USER: 'danger',
  REVOKE_PRO: 'danger',
  DELETE_ARTICLE: 'danger',
  REACTIVATE_USER: 'success',
  GRANT_PRO: 'success',
  CREATE_ARTICLE: 'info',
  UPDATE_ARTICLE: 'info',
  SEND_SMS_BROADCAST: 'warning',
}

function ActionBadge({ action }: { action: string }) {
  const variant = ACTION_VARIANT_MAP[action] ?? 'neutral'
  const label = action.replace(/_/g, ' ')
  return (
    <Badge variant={variant} size="sm">
      {label}
    </Badge>
  )
}

function formatDateTime(d: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d))
}

function MetadataCell({ metadata }: { metadata: unknown }) {
  const [expanded, setExpanded] = useState(false)

  if (metadata === null || metadata === undefined) {
    return <span className="text-[var(--color-text-muted)]">—</span>
  }

  const preview = JSON.stringify(metadata)
  const truncated = preview.length > 60 ? preview.slice(0, 60) + '…' : preview

  return (
    <div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setExpanded((v) => !v)
        }}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse metadata' : 'Expand metadata'}
        className="text-left text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
      >
        {expanded ? preview : truncated}
      </button>
    </div>
  )
}

const COLUMNS: Column<AuditLogRow>[] = [
  {
    key: 'createdAt',
    header: 'Timestamp',
    render: (row) => (
      <span className="text-sm tabular-nums text-[var(--color-text-muted)] whitespace-nowrap">
        {formatDateTime(row.createdAt)}
      </span>
    ),
  },
  {
    key: 'action',
    header: 'Action',
    render: (row) => <ActionBadge action={row.action} />,
  },
  {
    key: 'targetType',
    header: 'Target Type',
    render: (row) => (
      <span className="text-sm text-[var(--color-text-secondary)]">{row.targetType}</span>
    ),
  },
  {
    key: 'targetId',
    header: 'Target ID',
    render: (row) => (
      <span
        className="text-xs font-mono text-[var(--color-text-muted)] truncate max-w-[120px] block"
        title={row.targetId}
      >
        {row.targetId.length > 12 ? row.targetId.slice(0, 12) + '…' : row.targetId}
      </span>
    ),
  },
  {
    key: 'admin',
    header: 'Admin',
    render: (row) => {
      const display = row.admin?.fullName ?? row.admin?.email ?? row.adminId
      return (
        <span className="text-sm text-[var(--color-text-secondary)] truncate max-w-[140px] block">
          {display}
        </span>
      )
    },
  },
  {
    key: 'metadata',
    header: 'Metadata',
    render: (row) => <MetadataCell metadata={row.metadata} />,
  },
]

export function AuditLogClient({ data }: AuditLogClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const currentAction = searchParams.get('action') ?? ''
  const currentTargetType = searchParams.get('targetType') ?? ''
  const currentSearch = searchParams.get('search') ?? ''
  const currentPage = data.page
  const currentPageSize = data.pageSize

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

  function handleActionChange(value: string) {
    updateParams({ action: value })
  }

  function handleTargetTypeChange(value: string) {
    updateParams({ targetType: value })
  }

  function handlePageChange(page: number) {
    updateParams({ page })
  }

  function handlePageSizeChange(pageSize: number) {
    updateParams({ pageSize, page: 1 })
  }

  return (
    <div className="flex flex-1 flex-col gap-6 page-enter">
      <AdminPageHeader
        title="Audit Logs"
        description={`${data.total.toLocaleString()} total entries`}
        tags={[adminCacheTags.auditLogs]}
      />

      {/* Filters */}
      <FilterBar
        searchValue={currentSearch}
        onSearchChange={handleSearch}
        searchPlaceholder="Search by action or target ID…"
        filters={[
          {
            key: 'action',
            label: 'Action',
            options: ACTION_OPTIONS,
            value: currentAction,
            onChange: handleActionChange,
          },
          {
            key: 'targetType',
            label: 'Target Type',
            options: TARGET_TYPE_OPTIONS,
            value: currentTargetType,
            onChange: handleTargetTypeChange,
          },
        ]}
      />

      {/* Table */}
      <DataTable
        columns={COLUMNS}
        data={data.logs as unknown as AuditLogRow[]}
        emptyMessage="No audit log entries match your filters."
        keyExtractor={(row) => row.id}
      />

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={data.totalPages}
        pageSize={currentPageSize}
        total={data.total}
        itemLabel="entry"
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  )
}
