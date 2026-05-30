'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import {
  Mail,
  Send,
  AlertCircle,
  Server,
  Tag,
} from 'lucide-react'
import { FilterBar } from '@/components/ui/FilterBar'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { StatCard } from '@/components/ui/StatCard'
import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { adminCacheTags } from '@/lib/admin-cache-tags'

// ── Types ──────────────────────────────────────────────────────────────────

type EmailLogItem = {
  id: string
  type: string
  to: string
  subject: string
  status: string
  error: string | null
  provider: string
  resendId: string | null
  deliveryStatus: string
  sentAt: Date
  user: { id: string; fullName: string | null; email: string | null } | null
  profile: { id: string; name: string } | null
}

type EmailStats = {
  total: number
  byType: Record<string, number>
  byStatus: Record<string, number>
  byProvider: Record<string, number>
}

interface EmailsClientProps {
  data: {
    items: EmailLogItem[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
  stats: EmailStats
}

// ── Filter options ─────────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'MAGIC_LINK', label: 'Magic Link' },
  { value: 'PERIOD_ALERT', label: 'Period Alert' },
  { value: 'FERTILE_ALERT', label: 'Fertile Alert' },
  { value: 'LOGGING_REMINDER', label: 'Logging Reminder' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'SENT', label: 'Sent' },
  { value: 'FAILED', label: 'Failed' },
]

const DELIVERY_STATUS_OPTIONS = [
  { value: 'all', label: 'All Delivery' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'BOUNCED', label: 'Bounced' },
  { value: 'COMPLAINED', label: 'Complained' },
  { value: 'DELAYED', label: 'Delayed' },
]

// ── Badge helpers ──────────────────────────────────────────────────────────

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

function typeBadge(type: string) {
  const map: Record<string, { variant: BadgeVariant; label: string }> = {
    MAGIC_LINK: { variant: 'info', label: 'Magic Link' },
    PERIOD_ALERT: { variant: 'success', label: 'Period Alert' },
    FERTILE_ALERT: { variant: 'success', label: 'Fertile Alert' },
    LOGGING_REMINDER: { variant: 'neutral', label: 'Logging Reminder' },
  }
  const cfg = map[type] ?? { variant: 'neutral', label: type }
  return (
    <Badge variant={cfg.variant} size="sm">
      {cfg.label}
    </Badge>
  )
}

function statusBadge(status: string) {
  if (status === 'SENT') return <Badge variant="success" size="sm">Sent</Badge>
  if (status === 'FAILED') return <Badge variant="danger" size="sm">Failed</Badge>
  return <Badge variant="neutral" size="sm">{status}</Badge>
}

function deliveryBadge(deliveryStatus: string) {
  const map: Record<string, { variant: BadgeVariant; label: string }> = {
    DELIVERED: { variant: 'success', label: 'Delivered' },
    BOUNCED: { variant: 'danger', label: 'Bounced' },
    PENDING: { variant: 'warning', label: 'Pending' },
    DELAYED: { variant: 'warning', label: 'Delayed' },
    COMPLAINED: { variant: 'danger', label: 'Complained' },
  }
  const cfg = map[deliveryStatus] ?? { variant: 'neutral', label: deliveryStatus }
  return (
    <Badge variant={cfg.variant} size="sm">
      {cfg.label}
    </Badge>
  )
}

// ── Date formatter ─────────────────────────────────────────────────────────

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatSentAt(d: Date) {
  return dateFormatter.format(new Date(d))
}

// ── Stats helpers ──────────────────────────────────────────────────────────

function topEntry(record: Record<string, number>): string {
  const entries = Object.entries(record)
  if (!entries.length) return '—'
  entries.sort((a, b) => b[1] - a[1])
  const [key] = entries[0]
  // Humanise key: MAGIC_LINK → Magic Link
  return key
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// ── Main Client ─────────────────────────────────────────────────────────────

export function EmailsClient({ data, stats }: EmailsClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const currentType = searchParams.get('type') ?? 'all'
  const currentStatus = searchParams.get('status') ?? 'all'
  const currentDeliveryStatus = searchParams.get('deliveryStatus') ?? 'all'
  const currentSearch = searchParams.get('search') ?? ''

  const updateParams = useCallback(
    (updates: Record<string, string | number>) => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(updates).forEach(([k, v]) => {
        if (v === '' || v === undefined || v === 'all') {
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

  function handleTypeChange(value: string) {
    updateParams({ type: value })
  }

  function handleStatusChange(value: string) {
    updateParams({ status: value })
  }

  function handleDeliveryStatusChange(value: string) {
    updateParams({ deliveryStatus: value })
  }

  function handleSearchChange(value: string) {
    updateParams({ search: value })
  }

  function handlePageChange(page: number) {
    updateParams({ page })
  }

  function handlePageSizeChange(pageSize: number) {
    updateParams({ pageSize, page: 1 })
  }

  // ── Stats derived values ─────────────────────────────────────────────────

  const sentCount = stats.byStatus['SENT'] ?? 0
  const failedCount = stats.byStatus['FAILED'] ?? 0
  const resendCount = stats.byProvider['RESEND'] ?? 0
  const smtpCount = stats.byProvider['SMTP'] ?? 0
  const dominantProvider = resendCount >= smtpCount
    ? `Resend: ${resendCount.toLocaleString()}`
    : `SMTP: ${smtpCount.toLocaleString()}`

  // ── Table columns ────────────────────────────────────────────────────────

  const COLUMNS: Column<EmailLogItem>[] = [
    {
      key: 'sentAt',
      header: 'Sent At',
      sortable: true,
      render: (row) => (
        <span
          className="text-sm text-[var(--color-text-muted)] whitespace-nowrap"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {formatSentAt(row.sentAt)}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => typeBadge(row.type),
    },
    {
      key: 'to',
      header: 'To',
      render: (row) => (
        <span className="text-sm text-[var(--color-text-primary)] truncate max-w-[180px] block">
          {row.to}
        </span>
      ),
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (row) => (
        <span
          className="text-sm text-[var(--color-text-secondary)] truncate block max-w-[240px]"
          title={row.subject}
        >
          {row.subject.length > 50 ? `${row.subject.slice(0, 50)}…` : row.subject}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => statusBadge(row.status),
    },
    {
      key: 'deliveryStatus',
      header: 'Delivery',
      render: (row) => deliveryBadge(row.deliveryStatus),
    },
    {
      key: 'provider',
      header: 'Provider',
      render: (row) => (
        <span className="text-sm text-[var(--color-text-muted)]">{row.provider}</span>
      ),
    },
  ]

  return (
    <div className="space-y-6 page-enter">
      <AdminPageHeader
        title="Email Logs"
        description={`${data.total.toLocaleString()} email${data.total !== 1 ? 's' : ''} total`}
        tags={[adminCacheTags.emails]}
      />

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Emails Sent"
          value={stats.total.toLocaleString()}
          icon={<Mail size={18} aria-hidden="true" />}
        />
        <StatCard
          title="Sent / Failed"
          value={`${sentCount.toLocaleString()} / ${failedCount.toLocaleString()}`}
          icon={
            failedCount > 0
              ? <AlertCircle size={18} aria-hidden="true" />
              : <Send size={18} aria-hidden="true" />
          }
        />
        <StatCard
          title="By Provider"
          value={dominantProvider}
          icon={<Server size={18} aria-hidden="true" />}
        />
        <StatCard
          title="Top Type"
          value={topEntry(stats.byType)}
          icon={<Tag size={18} aria-hidden="true" />}
        />
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={currentSearch}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search by recipient or subject…"
        filters={[
          {
            key: 'type',
            label: 'Type',
            options: TYPE_OPTIONS,
            value: currentType,
            onChange: handleTypeChange,
          },
          {
            key: 'status',
            label: 'Status',
            options: STATUS_OPTIONS,
            value: currentStatus,
            onChange: handleStatusChange,
          },
          {
            key: 'deliveryStatus',
            label: 'Delivery',
            options: DELIVERY_STATUS_OPTIONS,
            value: currentDeliveryStatus,
            onChange: handleDeliveryStatusChange,
          },
        ]}
      />

      {/* Table */}
      <DataTable
        columns={COLUMNS}
        data={data.items}
        emptyMessage="No email logs match your filters."
        keyExtractor={(row) => row.id}
      />

      {/* Pagination */}
      <Pagination
        currentPage={data.page}
        totalPages={data.totalPages}
        pageSize={data.pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  )
}
