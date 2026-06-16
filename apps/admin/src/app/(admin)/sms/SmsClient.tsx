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
import { createSmsBroadcast, deleteSmsBroadcast, sendSmsBroadcast } from '@/app/actions/sms-actions'
import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { adminCacheTags } from '@/lib/admin-cache-tags'

type SmsBroadcast = {
  id: string
  message: string
  status: string
  scheduledFor: Date | null
  sentAt: Date | null
  targetCount: number | null
  deliveredCount: number | null
  failedCount: number | null
  createdAt: Date
  creator: { fullName: string | null; email: string | null }
}

interface SmsClientProps {
  data: {
    broadcasts: SmsBroadcast[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
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
  return status === 'DRAFT'
}

// ─── Create Broadcast Modal ─────────────────────────────────────────────────

interface CreateModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

function CreateBroadcastModal({ open, onClose, onCreated }: CreateModalProps) {
  const [message, setMessage] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 50)
    } else {
      setMessage('')
      setScheduledFor('')
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) {
      setError('Message cannot be empty.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await createSmsBroadcast(message.trim(), scheduledFor || undefined)
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
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
      <div className="relative z-10 w-full max-w-lg rounded-2xl glass border border-[var(--color-border)] shadow-soft focus:outline-none">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-primary)]/10">
              <Send size={15} className="text-[var(--color-primary)]" />
            </div>
            <h2 id="create-broadcast-title" className="text-base font-bold text-[var(--color-text-primary)]">
              New SMS Broadcast
            </h2>
          </div>
          <button
            onClick={() => !submitting && onClose()}
            disabled={submitting}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-40"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Message textarea */}
          <div className="space-y-1.5">
            <label
              htmlFor="sms-message"
              className="block text-sm font-medium text-[var(--color-text-secondary)]"
            >
              Message
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
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-colors transition-shadow duration-200 resize-none"
            />
            <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
              <span>{Math.ceil(charCount / 160)} SMS credit{Math.ceil(charCount / 160) !== 1 ? 's' : ''}</span>
              <span className={charCount > 440 ? 'text-amber-600' : ''}>{charCount}/480</span>
            </div>
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

          {/* Error */}
          {error && (
            <p className="text-sm text-red-500">{error}</p>
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
              {isScheduled ? 'Schedule Broadcast' : 'Save as Draft'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Client ─────────────────────────────────────────────────────────────

export function SmsClient({ data }: SmsClientProps) {
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
