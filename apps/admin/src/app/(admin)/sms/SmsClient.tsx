'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { CalendarClock, Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { FilterBar } from '@/components/ui/FilterBar'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'
import { deleteSmsBroadcast, sendSmsBroadcast } from '@/app/actions/sms-actions'
import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { adminCacheTags } from '@/lib/admin-cache-tags'
import { ChartPanel } from '@/components/charts/ChartPanelLazy'
import { CreateBroadcastModal } from './CreateBroadcastModal'
import { EditBroadcastModal } from './EditBroadcastModal'
import { RescheduleModal } from './RescheduleModal'
import { SendPreview, statusBadge, type SmsBroadcast } from './sms-shared'
import { UrlSegmentedControl } from '@/components/charts/UrlSegmentedControl'
import { canDeleteBroadcast, canEditBroadcast, canSendBroadcast } from '@vesta/shared/utils/sms'

type SmsSendHistoryPoint = { date: string; count: number }
type SmsDeliveryBreakdownItem = { status: string; count: number }

interface SmsClientProps {
  data: {
    broadcasts: SmsBroadcast[]
    total: number
    page: number
    pageSize: number
    totalPages: number
    overallTotal: number
  }
  sendHistory: SmsSendHistoryPoint[]
  deliveryBreakdown: SmsDeliveryBreakdownItem[]
  range: string
  nextSendId: string | null
}

const STATUS_OPTIONS = [
  { value: 'queue', label: 'Queue (unsent)' },
  { value: 'all', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'SENDING', label: 'Sending' },
  { value: 'SENT', label: 'Sent' },
  { value: 'FAILED', label: 'Failed' },
]

function formatDate(d: Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Main Client ─────────────────────────────────────────────────────────────

export function SmsClient({ data, sendHistory, deliveryBreakdown, nextSendId }: SmsClientProps) {
  const toast = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SmsBroadcast | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [sendTarget, setSendTarget] = useState<SmsBroadcast | null>(null)
  const [sending, setSending] = useState(false)
  const [editTarget, setEditTarget] = useState<SmsBroadcast | null>(null)
  const [rescheduleTarget, setRescheduleTarget] = useState<SmsBroadcast | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const currentStatus = searchParams.get('status') ?? 'queue'
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

  function handleStatusChange(value: string) {
    updateParams({ status: value })
  }

  function handlePageChange(page: number) {
    updateParams({ page })
  }

  function handlePageSizeChange(pageSize: number) {
    updateParams({ pageSize, page: 1 })
  }

  function handleCreated() {
    router.refresh()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteSmsBroadcast(deleteTarget.id)
      setDeleteTarget(null)
      toast.success('Broadcast deleted')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Could not delete the broadcast')
    } finally {
      setDeleting(false)
    }
  }

  async function handleSend() {
    if (!sendTarget) return
    setSending(true)
    try {
      await sendSmsBroadcast(sendTarget.id)
      setSendTarget(null)
      toast.success('Broadcast sent')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Could not send the broadcast')
      router.refresh()
    } finally {
      setSending(false)
    }
  }

  const filteredBroadcasts = searchTerm.trim()
    ? data.broadcasts.filter((b) =>
        b.message.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : data.broadcasts

  const COLUMNS: Column<SmsBroadcast>[] = [
    {
      key: 'message',
      header: 'Message',
      render: (row) => (
        <span
          className="block max-w-[300px] truncate text-sm text-[var(--color-text-primary)]"
          title={row.message}
        >
          {row.message}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div className="space-y-1">
          {statusBadge(row.status)}
          {row.status === 'FAILED' && row.lastError && (
            <p className="max-w-[220px] text-xs text-[var(--color-danger)]" title={row.lastError}>
              {row.lastError.length > 80 ? `${row.lastError.slice(0, 80)}…` : row.lastError}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'scheduledFor',
      header: 'Scheduled For',
      sortable: true,
      render: (row) => (
        <span className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          {formatDate(row.scheduledFor)}
          {row.id === nextSendId && <Badge variant="info" size="sm">Next send</Badge>}
        </span>
      ),
    },
    {
      key: 'sentAt',
      header: 'Sent At',
      sortable: true,
      render: (row) => (
        <span className="text-sm text-[var(--color-text-muted)]">
          {formatDate(row.sentAt)}
        </span>
      ),
    },
    {
      key: 'delivery',
      header: 'Delivery',
      render: (row) =>
        row.status === 'SENT' ? (
          <span className="whitespace-nowrap text-sm tabular-nums text-[var(--color-text-secondary)]">
            Delivered {row.deliveredCount ?? 0} · Failed {row.failedCount ?? 0}
          </span>
        ) : (
          <span className="text-sm text-[var(--color-text-muted)]">—</span>
        ),
    },
    {
      key: 'active',
      header: 'Active',
      render: (row) =>
        row.active && row.status === 'SENT' ? (
          <Badge variant="success" size="sm">Active</Badge>
        ) : (
          <span className="text-sm text-[var(--color-text-muted)]">—</span>
        ),
    },
    {
      key: 'creator',
      header: 'Creator',
      render: (row) => (
        <span className="text-sm text-[var(--color-text-muted)]">
          {row.creator.fullName ?? row.creator.email ?? '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '120px',
      render: (row) => (
        <div className="flex items-center gap-1">
          {canEditBroadcast(row.status) && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setEditTarget(row)
                }}
                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                aria-label="Edit broadcast"
                title="Edit"
              >
                <Pencil size={15} aria-hidden="true" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setRescheduleTarget(row)
                }}
                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                aria-label="Reschedule broadcast"
                title="Reschedule"
              >
                <CalendarClock size={15} aria-hidden="true" />
              </button>
            </>
          )}
          {canSendBroadcast(row.status) && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSendTarget(row)
              }}
              className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              aria-label="Send broadcast"
              title="Send Now"
            >
              <Send size={15} aria-hidden="true" />
            </button>
          )}
          {canDeleteBroadcast(row.status) && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setDeleteTarget(row)
              }}
              className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              aria-label="Delete broadcast"
              title="Delete"
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-1 flex-col gap-6 page-enter">
      <AdminPageHeader
        title="SMS Broadcasts"
        description={`${data.total.toLocaleString()} broadcast${data.total !== 1 ? 's' : ''} total`}
        tags={[adminCacheTags.sms]}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus aria-hidden="true" size={15} />
            New Broadcast
          </Button>
        }
      />

      {/* ── Charts ─────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Date range toggle — drives the send-history panel via ?range= */}
        <div className="flex justify-end">
          <UrlSegmentedControl />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* SMS send history over time */}
          <ChartPanel
            title="SMS Send History"
            data={sendHistory.map((d) => ({ date: d.date, count: d.count }))}
            xKey="date"
            series={[{ key: 'count', label: 'Messages sent' }]}
            kinds={['area', 'bar', 'line']}
            defaultKind="area"
            height={260}
            emptyLabel="No send history for this period"
          />

          {/* Broadcast delivery-status breakdown */}
          <ChartPanel
            title="Delivery Status Breakdown"
            data={deliveryBreakdown.map((d) => ({ status: d.status, count: d.count }))}
            xKey="status"
            series={[{ key: 'count', label: 'Broadcasts' }]}
            kinds={['bar', 'pie']}
            defaultKind="bar"
            height={260}
            emptyLabel="No broadcast data yet"
          />
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search broadcasts…"
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
        data={filteredBroadcasts as unknown as SmsBroadcast[]}
        emptyMessage={
          data.overallTotal === 0
            ? 'No broadcasts yet. Create the first one with New Broadcast.'
            : 'No broadcasts match your filters.'
        }
        keyExtractor={(row) => row.id}
      />

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={data.totalPages}
        pageSize={currentPageSize}
        total={data.total}
        itemLabel="broadcast"
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      {/* Create Modal */}
      <CreateBroadcastModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />

      <EditBroadcastModal target={editTarget} onClose={() => setEditTarget(null)} onSaved={handleCreated} />
      <RescheduleModal target={rescheduleTarget} onClose={() => setRescheduleTarget(null)} onSaved={handleCreated} />

      {/* Send Confirm */}
      <ConfirmModal
        open={Boolean(sendTarget)}
        onClose={() => setSendTarget(null)}
        onConfirm={handleSend}
        title="Send Broadcast Now?"
        message="This sends to all subscribers and cannot be undone."
        confirmLabel="Send Now"
        variant="warning"
        loading={sending}
      >
        {sendTarget && <SendPreview broadcast={sendTarget} />}
      </ConfirmModal>

      {/* Delete Confirm */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Broadcast?"
        message={
          deleteTarget
            ? `Delete the "${deleteTarget.message.slice(0, 60)}${deleteTarget.message.length > 60 ? '…' : ''}" broadcast? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  )
}
