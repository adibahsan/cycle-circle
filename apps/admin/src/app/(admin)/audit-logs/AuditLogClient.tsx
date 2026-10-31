'use client'

import { useUrlParams } from '@/lib/use-url-params'
import { useState } from 'react'
import { FilterBar } from '@/components/ui/FilterBar'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import {
  AUDIT_ACTION_VALUES,
  AUDIT_TARGET_TYPES,
  auditActionLabel,
  type AuditAction,
} from '@vesta/shared/server/services/audit-actions'
import { adminCacheTags } from '@/lib/admin-cache-tags'
import { formatDhaka } from '@vesta/shared/utils/dhaka-date'

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
  ...AUDIT_ACTION_VALUES.map((value) => ({ value, label: auditActionLabel(value) })),
]

const TARGET_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  ...AUDIT_TARGET_TYPES.map((value) => ({ value, label: value.replace(/([a-z])([A-Z])/g, '$1 $2') })),
]

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const ACTION_VARIANT_MAP: Partial<Record<AuditAction, BadgeVariant>> = {
  USER_SUSPENDED: 'danger',
  USER_DELETED: 'danger',
  PRO_REVOKED: 'danger',
  ARTICLE_DELETED: 'danger',
  USER_REACTIVATED: 'success',
  USER_RESTORED: 'success',
  PRO_GRANTED: 'success',
  ARTICLE_CREATED: 'info',
  SEND_SMS_BROADCAST: 'warning',
  DISPATCH_SMS_BROADCAST: 'warning',
  UPDATE_SMS_BROADCAST: 'info',
  RESCHEDULE_SMS_BROADCAST: 'info',
  SET_CRON_ENABLED: 'warning',
  TRIGGER_CRON_DAILY_REMINDERS: 'info',
  TRIGGER_CRON_CAAS_CHECK: 'info',
}

function ActionBadge({ action }: { action: string }) {
  const variant = ACTION_VARIANT_MAP[action as AuditAction] ?? 'neutral'
  const label = auditActionLabel(action)
  return (
    <Badge variant={variant} size="sm">
      {label}
    </Badge>
  )
}

function formatDateTime(d: Date) {
  return formatDhaka(d, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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
  const { searchParams, updateParams } = useUrlParams()

  const currentAction = searchParams.get('action') ?? ''
  const currentTargetType = searchParams.get('targetType') ?? ''
  const currentSearch = searchParams.get('search') ?? ''
  const currentPage = data.page
  const currentPageSize = data.pageSize


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
