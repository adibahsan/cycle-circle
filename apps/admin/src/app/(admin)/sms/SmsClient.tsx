'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState, useTransition, useRef, useEffect } from 'react'
import { Plus, Send, Trash2, X } from 'lucide-react'
import { FilterBar } from '@/components/ui/FilterBar'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Input } from '@/components/ui/Input'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import {
  createSmsBroadcast,
  createSmsBroadcastsBulk,
  deleteSmsBroadcast,
  sendSmsBroadcast,
} from '@/app/actions/sms-actions'
import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { adminCacheTags } from '@/lib/admin-cache-tags'
import { ChartPanel } from '@/components/charts/ChartPanelLazy'
import { DateRangeControl } from '@/components/charts/DateRangeControl'

type SmsBroadcast = {
  id: string
  message: string
  messageBn: string | null
  status: string
  scheduledFor: Date | null
  sentAt: Date | null
  targetCount: number | null
  deliveredCount: number | null
  failedCount: number | null
  createdAt: Date
  creator: { fullName: string | null; email: string | null }
}

type SmsSendHistoryPoint = { date: string; count: number }
type SmsDeliveryBreakdownItem = { status: string; count: number }

interface SmsClientProps {
  data: {
    broadcasts: SmsBroadcast[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
  sendHistory: SmsSendHistoryPoint[]
  deliveryBreakdown: SmsDeliveryBreakdownItem[]
  range: string
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'SENDING', label: 'Sending' },
  { value: 'SENT', label: 'Sent' },
  { value: 'FAILED', label: 'Failed' },
]

type StatusVariant = 'info' | 'warning' | 'success' | 'danger' | 'neutral'

function statusBadge(status: string) {
  const map: Record<string, { variant: StatusVariant; label: string }> = {
    DRAFT: { variant: 'info', label: 'Draft' },
    SCHEDULED: { variant: 'warning', label: 'Scheduled' },
    SENDING: { variant: 'warning', label: 'Sending' },
    SENT: { variant: 'success', label: 'Sent' },
    FAILED: { variant: 'danger', label: 'Failed' },
  }
  const cfg = map[status] ?? { variant: 'neutral', label: status }
  return <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>
}

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

function canDelete(status: string) {
  return status === 'DRAFT' || status === 'SCHEDULED' || status === 'FAILED'
}

function canSend(status: string) {
  return status === 'DRAFT' || status === 'SCHEDULED'
}

// ─── Create Broadcast Modal ─────────────────────────────────────────────────

interface CreateModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

function CreateBroadcastModal({ open, onClose, onCreated }: CreateModalProps) {
  const [mode, setMode] = useState<'single' | 'bulk'>('single')
  // Single mode state
  const [message, setMessage] = useState('')
  const [messageBn, setMessageBn] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  // Bulk mode state
  const [bulkText, setBulkText] = useState('')
  const [bulkStartDate, setBulkStartDate] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea when modal opens; reset all state when it closes
  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 50)
    } else {
      setMode('single')
      setMessage('')
      setMessageBn('')
      setScheduledFor('')
      setBulkText('')
      setBulkStartDate('')
      setError(null)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, submitting, onClose])

  if (!open) return null

  const bulkLineCount = bulkText
    .split('\n')
    .filter((l) => l.trim().length > 0).length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'single') {
      if (!message.trim()) {
        setError('Message cannot be empty.')
        return
      }
      setSubmitting(true)
      try {
        await createSmsBroadcast(
          message.trim(),
          messageBn.trim() || undefined,
          scheduledFor || undefined,
        )
        onCreated()
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      } finally {
        setSubmitting(false)
      }
    } else {
      if (bulkLineCount === 0) {
        setError('Enter at least one message line.')
        return
      }
      setSubmitting(true)
      try {
        await createSmsBroadcastsBulk(bulkText, bulkStartDate || undefined)
        onCreated()
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      } finally {
        setSubmitting(false)
      }
    }
  }

  const charCount = message.length
  const isScheduled = Boolean(scheduledFor)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-broadcast-title"
      style={{ overscrollBehavior: 'contain' }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => !submitting && onClose()}
        aria-hidden="true"
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl glass border border-[var(--color-border)] shadow-soft focus:outline-none max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-primary)]/10">
              <Send size={15} className="text-[var(--color-primary)]" aria-hidden="true" />
            </div>
            <h2 id="create-broadcast-title" className="text-base font-bold text-[var(--color-text-primary)]">
              New SMS Broadcast
            </h2>
          </div>
          <button
            onClick={() => !submitting && onClose()}
            disabled={submitting}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-40"
            aria-label="Close dialog"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Mode toggle */}
          <div
            className="flex gap-1 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-1"
            role="group"
            aria-label="Broadcast mode"
          >
            <button
              type="button"
              onClick={() => { setMode('single'); setError(null) }}
              className={[
                'flex-1 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
                mode === 'single'
                  ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
              ].join(' ')}
              aria-pressed={mode === 'single'}
            >
              Single
            </button>
            <button
              type="button"
              onClick={() => { setMode('bulk'); setError(null) }}
              className={[
                'flex-1 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
                mode === 'bulk'
                  ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
              ].join(' ')}
              aria-pressed={mode === 'bulk'}
            >
              Bulk
            </button>
          </div>

          {mode === 'single' ? (
            <>
              {/* English message textarea */}
              <div className="space-y-1.5">
                <label
                  htmlFor="sms-message"
                  className="block text-sm font-medium text-[var(--color-text-secondary)]"
                >
                  Message (English)
                </label>
                <textarea
                  id="sms-message"
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  maxLength={480}
                  placeholder="Type your SMS message here…"
                  name="message"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 focus-visible:border-[var(--color-primary)] transition-colors duration-200 resize-none"
                />
                <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                  <span>{Math.ceil(charCount / 160)} SMS credit{Math.ceil(charCount / 160) !== 1 ? 's' : ''}</span>
                  <span className={charCount > 440 ? 'text-amber-600' : ''}>{charCount}/480</span>
                </div>
              </div>

              {/* Bengali message textarea (optional) */}
              <div className="space-y-1.5">
                <label
                  htmlFor="sms-message-bn"
                  className="block text-sm font-medium text-[var(--color-text-secondary)]"
                >
                  Message (Bengali){' '}
                  <span className="text-[var(--color-text-muted)] font-normal">— optional</span>
                </label>
                <textarea
                  id="sms-message-bn"
                  value={messageBn}
                  onChange={(e) => setMessageBn(e.target.value)}
                  rows={3}
                  maxLength={480}
                  placeholder="বাংলায় বার্তা লিখুন…"
                  name="messageBn"
                  lang="bn"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 focus-visible:border-[var(--color-primary)] transition-colors duration-200 resize-none"
                />
              </div>

              {/* Schedule date (optional) */}
              <div className="space-y-1.5">
                <label
                  htmlFor="sms-scheduled"
                  className="block text-sm font-medium text-[var(--color-text-secondary)]"
                >
                  Schedule For{' '}
                  <span className="text-[var(--color-text-muted)] font-normal">(optional — leave blank to save as draft)</span>
                </label>
                <DateTimePicker
                  id="sms-scheduled"
                  aria-label="Schedule date and time"
                  value={scheduledFor}
                  onChange={setScheduledFor}
                  minDate={new Date()}
                />
              </div>

              {/* Status preview */}
              <div className="flex items-center gap-2 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] px-4 py-2.5 text-sm text-[var(--color-text-secondary)]">
                <span>Will be saved as:</span>
                {statusBadge(isScheduled ? 'SCHEDULED' : 'DRAFT')}
              </div>
            </>
          ) : (
            <>
              {/* Bulk textarea */}
              <div className="space-y-1.5">
                <label
                  htmlFor="sms-bulk"
                  className="block text-sm font-medium text-[var(--color-text-secondary)]"
                >
                  Messages (one per line)
                </label>
                <textarea
                  id="sms-bulk"
                  ref={textareaRef}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={8}
                  placeholder={"English message\nAnother message | বাংলা বার্তা\nThird message | তৃতীয় বার্তা"}
                  name="bulkText"
                  spellCheck={false}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 focus-visible:border-[var(--color-primary)] transition-colors duration-200 resize-none font-mono"
                />
                <p className="text-xs text-[var(--color-text-muted)]">
                  One message per line. Add a Bengali translation after a vertical bar:{' '}
                  <span className="font-mono text-[var(--color-text-secondary)]">English | বাংলা</span>
                </p>
                {/* Live preview line count */}
                <p
                  className="text-xs font-medium text-[var(--color-text-secondary)]"
                  aria-live="polite"
                >
                  {bulkLineCount} message{bulkLineCount !== 1 ? 's' : ''} will be scheduled
                </p>
              </div>

              {/* Bulk start date */}
              <div className="space-y-1.5">
                <label
                  htmlFor="sms-bulk-start"
                  className="block text-sm font-medium text-[var(--color-text-secondary)]"
                >
                  Start date{' '}
                  <span className="text-[var(--color-text-muted)] font-normal">
                    (one message per day from here; defaults to tomorrow)
                  </span>
                </label>
                <DateTimePicker
                  id="sms-bulk-start"
                  aria-label="Bulk start date"
                  value={bulkStartDate}
                  onChange={setBulkStartDate}
                  minDate={new Date()}
                />
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-red-500" role="alert" aria-live="polite">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={submitting}
            >
              {mode === 'bulk'
                ? `Schedule ${bulkLineCount > 0 ? bulkLineCount : ''} message${bulkLineCount !== 1 ? 's' : ''}`.trim()
                : isScheduled
                  ? 'Schedule Broadcast'
                  : 'Save as Draft'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Client ─────────────────────────────────────────────────────────────

export function SmsClient({ data, sendHistory, deliveryBreakdown }: SmsClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SmsBroadcast | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [sendTarget, setSendTarget] = useState<SmsBroadcast | null>(null)
  const [sending, setSending] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const currentStatus = searchParams.get('status') ?? 'all'
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
      router.refresh()
    } catch (err) {
      console.error(err)
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
      router.refresh()
    } catch (err) {
      console.error(err)
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
      render: (row) => statusBadge(row.status),
    },
    {
      key: 'scheduledFor',
      header: 'Scheduled For',
      sortable: true,
      render: (row) => (
        <span className="text-sm text-[var(--color-text-muted)]">
          {formatDate(row.scheduledFor)}
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
      key: 'targetCount',
      header: 'Target',
      render: (row) => (
        <span className="text-sm text-[var(--color-text-secondary)] tabular-nums">
          {row.targetCount?.toLocaleString() ?? '—'}
        </span>
      ),
    },
    {
      key: 'deliveredCount',
      header: 'Delivered',
      render: (row) => (
        <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">
          {row.deliveredCount?.toLocaleString() ?? '—'}
        </span>
      ),
    },
    {
      key: 'failedCount',
      header: 'Failed',
      render: (row) => (
        <span className="text-sm text-red-500 dark:text-red-400 font-medium tabular-nums">
          {row.failedCount?.toLocaleString() ?? '—'}
        </span>
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
      width: '80px',
      render: (row) => (
        <div className="flex items-center gap-1">
          {canSend(row.status) && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSendTarget(row)
              }}
              className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors"
              aria-label="Send broadcast"
              title="Send Now"
            >
              <Send size={15} aria-hidden="true" />
            </button>
          )}
          {canDelete(row.status) && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setDeleteTarget(row)
              }}
              className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
            <Plus size={15} />
            New Broadcast
          </Button>
        }
      />

      {/* ── Charts ─────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Date range toggle — drives the send-history panel via ?range= */}
        <div className="flex justify-end">
          <DateRangeControl />
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
        emptyMessage="No broadcasts match your filters."
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

      {/* Send Confirm */}
      <ConfirmModal
        open={Boolean(sendTarget)}
        onClose={() => setSendTarget(null)}
        onConfirm={handleSend}
        title="Send Broadcast Now?"
        message={
          sendTarget
            ? `Send "${sendTarget.message.slice(0, 60)}${sendTarget.message.length > 60 ? '…' : ''}" to all subscribers? This action cannot be undone.`
            : ''
        }
        confirmLabel="Send Now"
        variant="warning"
        loading={sending}
      />

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
