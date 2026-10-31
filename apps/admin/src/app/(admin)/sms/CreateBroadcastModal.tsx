'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { createSmsBroadcast, createSmsBroadcastsBulk, createSmsBroadcastsFromCsv, previewSmsCsv } from '@/app/actions/sms-actions'
import { composeSms, countSmsParts, SMS_CSV_TEMPLATE, SMS_PART_WARN_THRESHOLD, type SmsSendLanguage } from '@vesta/shared/utils/sms'
import { LanguagePicker, PartCounter, statusBadge } from './sms-shared'
import { formatDhaka } from '@vesta/shared/utils/dhaka-date'

// ─── Create Broadcast Modal ─────────────────────────────────────────────────

interface CreateModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export function CreateBroadcastModal({ open, onClose, onCreated }: CreateModalProps) {
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
                              <td className="px-3 py-2 whitespace-nowrap tabular-nums">{formatDhaka(r.sendAt, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
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
