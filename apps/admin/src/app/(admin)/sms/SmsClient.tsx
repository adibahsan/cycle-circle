'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState, useTransition, useRef, useEffect } from 'react'
import { CalendarClock, Pencil, Plus, Send, Trash2, X } from 'lucide-react'
import { FilterBar } from '@/components/ui/FilterBar'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { useToast } from '@/components/ui/Toast'
import {
  createSmsBroadcast,
  createSmsBroadcastsBulk,
  createSmsBroadcastsFromCsv,
  previewSmsCsv,
  deleteSmsBroadcast,
  sendSmsBroadcast,
  updateSmsBroadcast,
  rescheduleSmsBroadcast,
} from '@/app/actions/sms-actions'
import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { adminCacheTags } from '@/lib/admin-cache-tags'
import { ChartPanel } from '@/components/charts/ChartPanelLazy'
import { DateRangeControl } from '@/components/charts/DateRangeControl'
import {
  composeSms,
  countSmsParts,
  SMS_CSV_TEMPLATE,
  SMS_PART_WARN_THRESHOLD,
  type SmsSendLanguage,
} from '@vesta/shared/utils/sms'

type SmsBroadcast = {
  id: string
  message: string
  messageBn: string | null
  sendLanguage?: SmsSendLanguage
  active: boolean
  lastError: string | null
  sendAttempts: number
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

type StatusVariant = 'info' | 'warning' | 'success' | 'danger' | 'neutral'

function statusBadge(status: string) {
  const map: Record<string, { variant: StatusVariant; label: string }> = {
    DRAFT: { variant: 'info', label: 'Draft' },
    SCHEDULED: { variant: 'warning', label: 'Scheduled' },
    SENDING: { variant: 'warning', label: 'Sending' },
    SENT: { variant: 'success', label: 'Sent' },
    FAILED: { variant: 'danger', label: 'Failed to send' },
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

/** Date → `yyyy-MM-ddTHH:mm` in local time, the DateTimePicker's value shape. */
function toLocalInput(d: Date | null) {
  if (!d) return ''
  const x = new Date(d)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`
}

function canEdit(status: string) {
  return status === 'DRAFT' || status === 'SCHEDULED' || status === 'FAILED'
}

function canDelete(status: string) {
  return status === 'DRAFT' || status === 'SCHEDULED' || status === 'FAILED'
}

function canSend(status: string) {
  return status === 'DRAFT' || status === 'SCHEDULED'
}

// ─── Language picker + part counter ─────────────────────────────────────────

const LANGUAGE_OPTIONS: { value: SmsSendLanguage; label: string }[] = [
  { value: 'BOTH', label: 'Bengali + English' },
  { value: 'BN', label: 'Bengali only' },
  { value: 'EN', label: 'English only' },
]

function LanguagePicker({
  value,
  onChange,
  idPrefix,
}: {
  value: SmsSendLanguage
  onChange: (v: SmsSendLanguage) => void
  idPrefix: string
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="block text-sm font-medium text-[var(--color-text-secondary)]">Send language</legend>
      <div className="flex flex-wrap gap-2">
        {LANGUAGE_OPTIONS.map((o) => (
          <label
            key={o.value}
            htmlFor={`${idPrefix}-${o.value}`}
            className={[
              'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors focus-within:ring-2 focus-within:ring-[var(--color-primary)]/30',
              value === o.value
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-text-primary)]'
                : 'border-[var(--color-border)] text-[var(--color-text-muted)]',
            ].join(' ')}
          >
            <input
              id={`${idPrefix}-${o.value}`}
              type="radio"
              name={`${idPrefix}-language`}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function PartCounter({ text }: { text: string }) {
  const { encoding, parts, charsLeft } = countSmsParts(text)
  const warn = parts > SMS_PART_WARN_THRESHOLD
  return (
    <div className="space-y-1" aria-live="polite">
      <p className={`text-xs tabular-nums ${warn ? 'text-[var(--color-warning)] font-medium' : 'text-[var(--color-text-muted)]'}`}>
        {parts} SMS part{parts !== 1 ? 's' : ''} · {encoding === 'UCS2' ? 'Unicode (Bengali), 70/67 per part' : 'GSM-7, 160/153 per part'} · {charsLeft} left in this part
      </p>
      {warn && (
        <p className="text-xs text-[var(--color-warning)]" role="status">
          Over {SMS_PART_WARN_THRESHOLD} parts: every subscriber is charged for {parts} SMS. Consider shortening the message.
        </p>
      )}
    </div>
  )
}

// ─── Create Broadcast Modal ─────────────────────────────────────────────────

interface CreateModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

function CreateBroadcastModal({ open, onClose, onCreated }: CreateModalProps) {
  const [mode, setMode] = useState<'single' | 'bulk' | 'csv'>('single')
  // Single mode state
  const [message, setMessage] = useState('')
  const [messageBn, setMessageBn] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  // Bulk mode state
  const [bulkText, setBulkText] = useState('')
  const [bulkStartDate, setBulkStartDate] = useState('')
  const [language, setLanguage] = useState<SmsSendLanguage>('BOTH')
  // CSV mode state
  const [csvText, setCsvText] = useState('')
  const [csvPreview, setCsvPreview] = useState<Awaited<ReturnType<typeof previewSmsCsv>> | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Reset all state when the modal closes (the shell focuses [data-autofocus] on open)
  useEffect(() => {
    if (!open) {
      setMode('single')
      setMessage('')
      setMessageBn('')
      setScheduledFor('')
      setBulkText('')
      setBulkStartDate('')
      setLanguage('BOTH')
      setCsvText('')
      setCsvPreview(null)
      setError(null)
    }
  }, [open])

  const bulkLineCount = bulkText
    .split('\n')
    .filter((l) => l.trim().length > 0).length

  // Re-run the preview when the start date changes after a file was loaded
  async function runPreview(text: string, start: string) {
    try {
      setCsvPreview(await previewSmsCsv(text, start || undefined))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the CSV.')
    }
  }

  async function handleCsvFile(file: File | undefined) {
    if (!file) return
    setError(null)
    const text = await file.text()
    setCsvText(text)
    await runPreview(text, bulkStartDate)
  }

  function downloadTemplate() {
    const blob = new Blob(['\uFEFF' + SMS_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sms-broadcast-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'csv') {
      if (!csvPreview || csvPreview.rows.length === 0) {
        setError('Choose a CSV file with at least one valid message.')
        return
      }
      setSubmitting(true)
      try {
        await createSmsBroadcastsFromCsv(csvText, bulkStartDate || undefined, language)
        onCreated()
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      } finally {
        setSubmitting(false)
      }
      return
    }

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
          language,
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
        await createSmsBroadcastsBulk(bulkText, bulkStartDate || undefined, language)
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
  let composed = ''
  let composeError: string | null = null
  try {
    composed = composeSms(message.trim(), messageBn.trim() || null, language)
  } catch (e) {
    composeError = e instanceof Error ? e.message : null
  }
  const isScheduled = Boolean(scheduledFor)

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId="create-broadcast-title"
      dismissible={!submitting}
      panelClassName="max-w-lg"
      initialFocusRef={textareaRef}
    >
      <div>
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
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
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
                'flex-1 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
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
                'flex-1 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                mode === 'bulk'
                  ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
              ].join(' ')}
              aria-pressed={mode === 'bulk'}
            >
              Bulk
            </button>
            <button
              type="button"
              onClick={() => { setMode('csv'); setError(null) }}
              className={[
                'flex-1 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                mode === 'csv'
                  ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
              ].join(' ')}
              aria-pressed={mode === 'csv'}
            >
              CSV
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
                <p className={`text-right text-xs tabular-nums ${charCount > 440 ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-muted)]'}`}>{charCount}/480</p>
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

              <LanguagePicker value={language} onChange={setLanguage} idPrefix="sms-lang" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">What handsets receive</p>
                {composeError ? (
                  <p className="text-xs text-[var(--color-danger)]" role="alert">{composeError}</p>
                ) : (
                  <>
                    {composed && (
                      <p lang={language === 'EN' ? 'en' : 'bn'} className="whitespace-pre-wrap rounded-lg bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
                        {composed}
                      </p>
                    )}
                    <PartCounter text={composed} />
                  </>
                )}
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
          ) : mode === 'bulk' ? (
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

              <LanguagePicker value={language} onChange={setLanguage} idPrefix="sms-bulk-lang" />

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
          ) : (
            <>
              <div className="space-y-1.5">
                <label htmlFor="sms-csv" className="block text-sm font-medium text-[var(--color-text-secondary)]">
                  CSV file
                </label>
                <input
                  id="sms-csv"
                                    type="file"
                  name="csv"
                  accept=".csv,text/csv"
                  onChange={(e) => void handleCsvFile(e.target.files?.[0])}
                  className="block w-full text-sm text-[var(--color-text-secondary)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-bg-secondary)] file:px-3 file:py-1.5 file:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30"
                />
                <p className="text-xs text-[var(--color-text-muted)]">
                  Columns: <span className="font-mono">scheduled_date, message_en, message_bn</span>. Leave the date empty to
                  schedule one per day from the start date.{' '}
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    className="underline text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 rounded"
                  >
                    Download template
                  </button>
                </p>
              </div>

              <LanguagePicker value={language} onChange={setLanguage} idPrefix="sms-csv-lang" />

              <div className="space-y-1.5">
                <label htmlFor="sms-csv-start" className="block text-sm font-medium text-[var(--color-text-secondary)]">
                  Start date{' '}
                  <span className="text-[var(--color-text-muted)] font-normal">(for lines without a date; defaults to tomorrow)</span>
                </label>
                <DateTimePicker
                  id="sms-csv-start"
                  aria-label="CSV start date"
                  value={bulkStartDate}
                  onChange={(v) => {
                    setBulkStartDate(v)
                    if (csvText) void runPreview(csvText, v)
                  }}
                  minDate={new Date()}
                />
              </div>

              {csvPreview && (
                <div className="space-y-2" aria-live="polite">
                  {csvPreview.errors.length > 0 && (
                    <ul className="space-y-0.5 text-xs text-[var(--color-danger)]" role="alert">
                      {csvPreview.errors.map((er) => (
                        <li key={er.line}>Line {er.line}: {er.message}</li>
                      ))}
                    </ul>
                  )}
                  <div className="max-h-56 overflow-auto overscroll-contain rounded-xl border border-[var(--color-border)]">
                    <table className="w-full text-left text-xs">
                      <caption className="sr-only">Send date preview</caption>
                      <thead className="bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]">
                        <tr>
                          <th scope="col" className="px-3 py-2 font-medium">Goes out</th>
                          <th scope="col" className="px-3 py-2 font-medium">Message</th>
                          <th scope="col" className="px-3 py-2 font-medium">Parts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.rows.map((r, i) => {
                          let text = r.messageEn
                          try { text = composeSms(r.messageEn, r.messageBn ?? null, language) } catch { /* flagged below */ }
                          const bad = language === 'BN' && !r.messageBn
                          const { parts } = countSmsParts(text)
                          return (
                            <tr key={i} className="border-t border-[var(--color-border)] align-top">
                              <td className="px-3 py-2 whitespace-nowrap tabular-nums">{new Date(r.sendAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                              <td className="px-3 py-2" lang={language === 'EN' ? 'en' : 'bn'}>
                                {bad ? <span className="text-[var(--color-danger)]">Missing Bengali text</span> : text}
                              </td>
                              <td className={`px-3 py-2 tabular-nums ${parts > SMS_PART_WARN_THRESHOLD ? 'text-[var(--color-warning)] font-medium' : ''}`}>{parts}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                    {csvPreview.rows.length} message{csvPreview.rows.length !== 1 ? 's' : ''} will be scheduled
                  </p>
                </div>
              )}
            </>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-[var(--color-danger)]" role="alert" aria-live="polite">
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
              {mode === 'csv'
                ? `Schedule ${csvPreview?.rows.length ?? ''} message${csvPreview?.rows.length === 1 ? '' : 's'}`.trim()
                : mode === 'bulk'
                ? `Schedule ${bulkLineCount > 0 ? bulkLineCount : ''} message${bulkLineCount !== 1 ? 's' : ''}`.trim()
                : isScheduled
                  ? 'Schedule Broadcast'
                  : 'Save as Draft'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  )
}

function SendPreview({ broadcast }: { broadcast: SmsBroadcast }) {
  const language = broadcast.sendLanguage ?? 'BOTH'
  let text = ''
  let problem: string | null = null
  try {
    text = composeSms(broadcast.message, broadcast.messageBn, language)
  } catch (e) {
    problem = e instanceof Error ? e.message : 'Cannot compose this message'
  }
  const label = LANGUAGE_OPTIONS.find((o) => o.value === language)?.label ?? language
  return (
    <div className="mt-4 space-y-2 text-left">
      <p className="text-xs text-[var(--color-text-secondary)]">
        Language: <span className="font-medium">{label}</span>
      </p>
      {problem ? (
        <p className="text-xs text-[var(--color-danger)]" role="alert">{problem}</p>
      ) : (
        <>
          <p lang={language === 'EN' ? 'en' : 'bn'} className="whitespace-pre-wrap rounded-lg bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
            {text}
          </p>
          <PartCounter text={text} />
        </>
      )}
    </div>
  )
}

// ─── Edit / Reschedule modals ───────────────────────────────────────────────

const TEXTAREA_CLASS =
  'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 focus-visible:border-[var(--color-primary)] transition-colors duration-200 resize-none'

function EditBroadcastModal({
  target,
  onClose,
  onSaved,
}: {
  target: SmsBroadcast | null
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [message, setMessage] = useState('')
  const [messageBn, setMessageBn] = useState('')
  const [language, setLanguage] = useState<SmsSendLanguage>('BOTH')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (target) {
      setMessage(target.message)
      setMessageBn(target.messageBn ?? '')
      setLanguage(target.sendLanguage ?? 'BOTH')
    }
  }, [target])

  let composed = ''
  let composeError: string | null = null
  try {
    composed = composeSms(message.trim(), messageBn.trim() || null, language)
  } catch (e) {
    composeError = e instanceof Error ? e.message : null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!target) return
    if (!message.trim()) {
      toast.error('Message cannot be empty.')
      return
    }
    if (composeError) {
      toast.error(composeError)
      return
    }
    setSaving(true)
    try {
      await updateSmsBroadcast(target.id, {
        message: message.trim(),
        messageBn: messageBn.trim() || undefined,
        sendLanguage: language,
      })
      toast.success(target.status === 'FAILED' ? 'Broadcast updated and re-queued' : 'Broadcast updated')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Could not update the broadcast')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      titleId="edit-broadcast-title"
      dismissible={!saving}
      panelClassName="max-w-lg"
      initialFocusRef={textareaRef}
    >
      <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
        <h2 id="edit-broadcast-title" className="text-base font-bold text-[var(--color-text-primary)]">
          Edit broadcast
        </h2>
        <div className="space-y-1.5">
          <label htmlFor="sms-edit-message" className="block text-sm font-medium text-[var(--color-text-secondary)]">
            Message (English)
          </label>
          <textarea
            id="sms-edit-message"
            name="message"
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={480}
            className={TEXTAREA_CLASS}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="sms-edit-message-bn" className="block text-sm font-medium text-[var(--color-text-secondary)]">
            Message (Bengali) <span className="font-normal text-[var(--color-text-muted)]">— optional</span>
          </label>
          <textarea
            id="sms-edit-message-bn"
            name="messageBn"
            lang="bn"
            value={messageBn}
            onChange={(e) => setMessageBn(e.target.value)}
            rows={3}
            maxLength={480}
            className={TEXTAREA_CLASS}
          />
        </div>
        <LanguagePicker value={language} onChange={setLanguage} idPrefix="sms-edit-lang" />
        <div className="space-y-1">
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">What handsets receive</p>
          {composeError ? (
            <p className="text-xs text-[var(--color-danger)]" role="alert">{composeError}</p>
          ) : (
            <>
              {composed && (
                <p lang={language === 'EN' ? 'en' : 'bn'} className="whitespace-pre-wrap rounded-lg bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
                  {composed}
                </p>
              )}
              <PartCounter text={composed} />
            </>
          )}
        </div>
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" fullWidth onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" fullWidth loading={saving}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function RescheduleModal({
  target,
  onClose,
  onSaved,
}: {
  target: SmsBroadcast | null
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [when, setWhen] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (target) setWhen(toLocalInput(target.scheduledFor))
  }, [target])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!target) return
    const date = new Date(when)
    if (!when || Number.isNaN(date.getTime())) {
      toast.error('Pick a date and time.')
      return
    }
    setSaving(true)
    try {
      await rescheduleSmsBroadcast(target.id, date.toISOString())
      toast.success('Broadcast rescheduled')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Could not reschedule the broadcast')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={Boolean(target)} onClose={onClose} titleId="reschedule-broadcast-title" dismissible={!saving} panelClassName="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
        <h2 id="reschedule-broadcast-title" className="text-base font-bold text-[var(--color-text-primary)]">
          Reschedule broadcast
        </h2>
        {target && (
          <p className="truncate text-sm text-[var(--color-text-muted)]" title={target.message}>
            {target.message}
          </p>
        )}
        <div className="space-y-1.5">
          <label htmlFor="sms-reschedule" className="block text-sm font-medium text-[var(--color-text-secondary)]">
            New send time
          </label>
          <DateTimePicker id="sms-reschedule" aria-label="New send date and time" value={when} onChange={setWhen} minDate={new Date()} />
        </div>
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" fullWidth onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" fullWidth loading={saving}>
            Reschedule
          </Button>
        </div>
      </form>
    </Modal>
  )
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
          {canEdit(row.status) && (
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
          {canSend(row.status) && (
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
          {canDelete(row.status) && (
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
