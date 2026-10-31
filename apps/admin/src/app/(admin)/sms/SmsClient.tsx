'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUrlParams } from '@/lib/use-url-params'
import { useState } from 'react'
import { CalendarClock, Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { FilterBar } from '@/components/ui/FilterBar'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'
import { deleteSmsCampaign, sendSmsMessage } from '@/app/actions/sms-actions'
import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { adminCacheTags } from '@/lib/admin-cache-tags'
import { ChartPanel } from '@/components/charts/ChartPanelLazy'
import { CreateBroadcastModal } from './CreateBroadcastModal'
import { EditBroadcastModal } from './EditBroadcastModal'
import { RescheduleModal } from './RescheduleModal'
import { SendPreview, TotalsLines, formatDay, formatSentAt, statusBadge, type SmsCampaign, type SmsMessage } from './sms-shared'
import { UrlSegmentedControl } from '@/components/charts/UrlSegmentedControl'
import { canDeleteCampaign, canEditMessage, canSendMessage } from '@vesta/shared/utils/sms'

type SmsSendHistoryPoint = { date: string; count: number }
type SmsDeliveryBreakdownItem = { status: string; count: number }

interface SmsClientProps {
  data: {
    campaigns: SmsCampaign[]
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
  { value: 'all', label: 'All' },
  { value: 'planned', label: 'Planned' },
  { value: 'running', label: 'Running' },
  { value: 'finished', label: 'Finished' },
  { value: 'cancelled', label: 'Cancelled' },
]

/** "Nov 1, 2026" for a one-day campaign, "Nov 1, 2026 – Nov 7, 2026 (5 days)" for a series. */
function daysLabel(messages: SmsMessage[]) {
  if (messages.length === 0) return '—'
  const first = formatDay(messages[0].day)
  if (messages.length === 1) return first
  return `${first} – ${formatDay(messages[messages.length - 1].day)} (${messages.length} days)`
}

// ─── Main Client ─────────────────────────────────────────────────────────────

export function SmsClient({ data, sendHistory, deliveryBreakdown, nextSendId }: SmsClientProps) {
  const toast = useToast()
  const router = useRouter()
  const { searchParams, updateParams } = useUrlParams()

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SmsCampaign | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [sendTarget, setSendTarget] = useState<SmsMessage | null>(null)
  const [sending, setSending] = useState(false)
  const [editTarget, setEditTarget] = useState<SmsMessage | null>(null)
  const [rescheduleTarget, setRescheduleTarget] = useState<SmsMessage | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const currentStatus = searchParams.get('status') ?? 'all'
  const currentPage = data.page
  const currentPageSize = data.pageSize

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
      const result = await deleteSmsCampaign(deleteTarget.id)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setDeleteTarget(null)
      toast.success('Campaign deleted')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Could not delete the campaign')
    } finally {
      setDeleting(false)
    }
  }

  async function handleSend() {
    if (!sendTarget) return
    setSending(true)
    try {
      await sendSmsMessage(sendTarget.id)
      setSendTarget(null)
      toast.success('Message sent')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Could not send the message')
      router.refresh()
    } finally {
      setSending(false)
    }
  }

  const needle = searchTerm.trim().toLowerCase()
  const filteredCampaigns = needle
    ? data.campaigns.filter(
        (c) => c.name.toLowerCase().includes(needle) || c.messages.some((m) => m.body.toLowerCase().includes(needle)),
      )
    : data.campaigns

  const iconButton =
    'p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'

  const COLUMNS: Column<SmsCampaign>[] = [
    {
      key: 'name',
      header: 'Campaign',
      render: (row) => (
        <Link
          href={`/sms/${row.id}`}
          className="block max-w-[300px] truncate text-sm font-medium text-[var(--color-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          title={row.name}
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: 'days',
      header: 'Days',
      render: (row) => (
        <span className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          {daysLabel(row.messages)}
          {row.id === nextSendId && <Badge variant="info" size="sm">Next send</Badge>}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const failed = row.messages.find((m) => m.status === 'FAILED' && m.lastError)
        const sent = row.messages.filter((m) => m.status === 'SENT').length
        return (
          <div className="space-y-1">
            {statusBadge(row.status)}
            <p className="text-xs tabular-nums text-[var(--color-text-muted)]">
              {sent} of {row.messages.length} sent
            </p>
            <TotalsLines messages={row.messages} />
            {failed?.lastError && (
              <p className="max-w-[220px] text-xs text-[var(--color-danger)]" title={failed.lastError}>
                {failed.lastError.length > 80 ? `${failed.lastError.slice(0, 80)}…` : failed.lastError}
              </p>
            )}
          </div>
        )
      },
    },
    {
      key: 'sentAt',
      header: 'Last sent',
      render: (row) => {
        const sentAts = row.messages.map((m) => m.sentAt).filter((t): t is NonNullable<typeof t> => Boolean(t))
        const last = sentAts.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
        return <span className="text-sm text-[var(--color-text-muted)]">{formatSentAt(last ?? null)}</span>
      },
    },
    {
      key: 'creator',
      header: 'Created by',
      render: (row) => (
        <span className="text-sm text-[var(--color-text-muted)]">
          {row.creator.fullName ?? row.creator.email ?? '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '140px',
      render: (row) => {
        // A one-day campaign has one message: the quick actions work on it. Longer series are
        // managed from the campaign view.
        const message = row.messages.length === 1 ? row.messages[0] : null
        return (
          <div className="flex items-center gap-1">
            {message && canEditMessage(message.status) && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditTarget(message)
                  }}
                  className={iconButton}
                  aria-label="Edit message"
                  title="Edit"
                >
                  <Pencil size={15} aria-hidden="true" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setRescheduleTarget(message)
                  }}
                  className={iconButton}
                  aria-label="Move message to another day"
                  title="Move to another day"
                >
                  <CalendarClock size={15} aria-hidden="true" />
                </button>
              </>
            )}
            {message && canSendMessage(message.status) && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSendTarget(message)
                }}
                className={iconButton}
                aria-label="Send message now"
                title="Send Now"
              >
                <Send size={15} aria-hidden="true" />
              </button>
            )}
            {canDeleteCampaign(row.messages) && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteTarget(row)
                }}
                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                aria-label="Delete campaign"
                title="Delete"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="flex flex-1 flex-col gap-6 page-enter">
      <AdminPageHeader
        title="SMS Campaigns"
        description={`${data.total.toLocaleString()} campaign${data.total !== 1 ? 's' : ''}`}
        tags={[adminCacheTags.sms]}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus aria-hidden="true" size={15} />
            New Campaign
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

          {/* Campaign-message status breakdown */}
          <ChartPanel
            title="Message Status Breakdown"
            data={deliveryBreakdown.map((d) => ({ status: d.status, count: d.count }))}
            xKey="status"
            series={[{ key: 'count', label: 'Messages' }]}
            kinds={['bar', 'pie']}
            defaultKind="bar"
            height={260}
            emptyLabel="No campaign data yet"
          />
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search campaigns…"
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
        data={filteredCampaigns as unknown as SmsCampaign[]}
        emptyMessage={
          data.overallTotal === 0
            ? 'No campaigns yet. Create the first one with New Campaign.'
            : 'No campaigns match your filters.'
        }
        keyExtractor={(row) => row.id}
      />

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={data.totalPages}
        pageSize={currentPageSize}
        total={data.total}
        itemLabel="campaign"
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
        title="Send Message Now?"
        message="This sends to all subscribers and cannot be undone. Only one message can go out per day."
        confirmLabel="Send Now"
        variant="warning"
        loading={sending}
      >
        {sendTarget && <SendPreview body={sendTarget.body} />}
      </ConfirmModal>

      {/* Delete Confirm */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Campaign?"
        message={
          deleteTarget
            ? `Delete the campaign "${deleteTarget.name}"? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  )
}
