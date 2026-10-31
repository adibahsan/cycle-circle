'use client'

import { useState, useRef } from 'react'
import { Plus, Send, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { createSmsCampaign, importSmsCampaignCsv, type CampaignImportRefusal } from '@/app/actions/sms-actions'
import {
  SMS_MAX_CAMPAIGN_MESSAGES,
  SMS_MAX_CAMPAIGN_NAME,
  SMS_MAX_CSV_CHARS,
  campaignCsvTemplate,
  validateSmsBody,
} from '@vesta/shared/utils/sms'
import { addDaysToDay, bangladeshToday } from '@vesta/shared/utils/dhaka-date'
import { PartCounter, TEXTAREA_CLASS } from './sms-shared'

// ─── Create Campaign Modal ─────────────────────────────────────────────────
// One campaign = a name plus one text per Bangladesh day. Days may have gaps. The days are typed in
// here, or imported from a `day,text` CSV (all-or-nothing: any bad row refuses the whole file).

interface DraftMessage {
  key: number
  /** Bangladesh day, `YYYY-MM-DD`; '' until picked. */
  day: string
  body: string
}

type Mode = 'manual' | 'csv'

interface RowError {
  line: number
  message: string
}

interface CreateModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

const INPUT_CLASS =
  'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 focus-visible:border-[var(--color-primary)] transition-colors duration-200'

/** The first thing wrong with the draft, or null. Mirrors the server rules (which stay the authority). */
function draftProblem(name: string, messages: DraftMessage[], today: string): string | null {
  if (!name.trim()) return 'Give the campaign a name.'
  if (messages.length > SMS_MAX_CAMPAIGN_MESSAGES) return `A campaign can have at most ${SMS_MAX_CAMPAIGN_MESSAGES} messages.`
  const seen = new Set<string>()
  for (const [i, m] of messages.entries()) {
    const n = i + 1
    if (!m.day) return `Pick a day for message ${n}.`
    if (m.day < today) return `Message ${n}: ${m.day} is in the past.`
    if (seen.has(m.day)) return `Message ${n}: ${m.day} is used twice in this campaign.`
    seen.add(m.day)
    const bodyProblem = validateSmsBody(m.body)
    if (bodyProblem) return `Message ${n}: ${bodyProblem}.`
  }
  return null
}

/**
 * The shell only decides *when* the form exists. The form is a child keyed by the open session, so
 * every open starts from fresh state without any reset effect: ids and keys stay stable for as long
 * as the dialog is open, and nothing re-keys a field the admin is typing into.
 */
export function CreateBroadcastModal({ open, onClose, onCreated }: CreateModalProps) {
  const [session, setSession] = useState(0)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSession((n) => n + 1)
  }
  const [submitting, setSubmitting] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId="create-campaign-title"
      dismissible={!submitting}
      panelClassName="max-w-lg"
      initialFocusRef={nameRef}
    >
      <ComposerForm
        key={session}
        nameRef={nameRef}
        onClose={onClose}
        onCreated={onCreated}
        submitting={submitting}
        setSubmitting={setSubmitting}
      />
    </Modal>
  )
}

function ComposerForm({
  nameRef,
  onClose,
  onCreated,
  submitting,
  setSubmitting,
}: Pick<CreateModalProps, 'onClose' | 'onCreated'> & {
  nameRef: React.RefObject<HTMLInputElement | null>
  submitting: boolean
  setSubmitting: (v: boolean) => void
}) {
  const nextKey = useRef(2)
  const [name, setName] = useState('')
  const [messages, setMessages] = useState<DraftMessage[]>([{ key: 1, day: '', body: '' }])
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('manual')
  const [csv, setCsv] = useState<{ fileName: string; text: string } | null>(null)
  const [rowErrors, setRowErrors] = useState<RowError[]>([])
  const newDraft = (): DraftMessage => ({
    key: nextKey.current++,
    day: '',
    body: '',
  })

  const today = bangladeshToday()
  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(
    campaignCsvTemplate(addDaysToDay(today, 1), addDaysToDay(today, 2)),
  )}`

  function switchMode(next: Mode) {
    if (submitting) return
    setMode(next)
    setError(null)
    setRowErrors([])
  }

  async function handleFile(file: File | undefined) {
    setError(null)
    setRowErrors([])
    if (!file) {
      setCsv(null)
      return
    }
    if (file.size > SMS_MAX_CSV_CHARS) {
      setCsv(null)
      setError('That file is too large to import.')
      return
    }
    try {
      setCsv({ fileName: file.name, text: await file.text() })
    } catch {
      setCsv(null)
      setError('Could not read that file.')
    }
  }

  function patch(key: number, change: Partial<DraftMessage>) {
    setMessages((list) => list.map((m) => (m.key === key ? { ...m, ...change } : m)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setRowErrors([])

    let problem: string | null
    if (mode === 'csv') problem = !name.trim() ? 'Give the campaign a name.' : !csv ? 'Choose a CSV file to import.' : null
    else problem = draftProblem(name, messages, today)
    if (problem) {
      setError(problem)
      return
    }

    setSubmitting(true)
    try {
      const res =
        mode === 'csv'
          ? await importSmsCampaignCsv({ name: name.trim(), csv: csv!.text })
          : await createSmsCampaign({
              name: name.trim(),
              messages: messages.map((m) => ({ day: m.day, body: m.body })),
            })
      if ('error' in res) {
        setError(res.error)
        setRowErrors((res as CampaignImportRefusal).rowErrors ?? [])
        return
      }
      onCreated()
      onClose()
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-primary)]/10">
            <Send size={15} className="text-[var(--color-primary)]" aria-hidden="true" />
          </div>
          <h2 id="create-campaign-title" className="text-base font-bold text-[var(--color-text-primary)]">
            New SMS Campaign
          </h2>
        </div>
        <button
          type="button"
          onClick={() => !submitting && onClose()}
          disabled={submitting}
          className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          aria-label="Close dialog"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Body */}
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="campaign-name" className="block text-sm font-medium text-[var(--color-text-secondary)]">
            Campaign name
          </label>
          <input
            id="campaign-name"
            name="campaign-name"
            ref={nameRef}
            type="text"
            autoComplete="off"
            maxLength={SMS_MAX_CAMPAIGN_NAME}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ovulation week series…"
            className={INPUT_CLASS}
          />
        </div>

        <div role="tablist" aria-label="How to add the days" className="flex gap-1 rounded-xl bg-[var(--color-bg-secondary)] p-1">
          {([
            ['manual', 'Add days'],
            ['csv', 'Import CSV'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              id={`campaign-mode-${value}`}
              aria-selected={mode === value}
              onClick={() => switchMode(value)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
                mode === value
                  ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'csv' ? (
          <div className="space-y-3">
            <p className="text-xs text-[var(--color-text-muted)]">
              One row per day: <code>day</code> (Bangladesh day, YYYY-MM-DD) and <code>text</code> (the message). Up to{' '}
              {SMS_MAX_CAMPAIGN_MESSAGES} rows. Any invalid row refuses the whole file, so nothing is half-imported.{' '}
              <a
                href={templateHref}
                download="campaign-template.csv"
                className="font-medium text-[var(--color-primary)] underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              >
                Download template
              </a>
            </p>
            <div className="space-y-1.5">
              <label htmlFor="campaign-csv" className="block text-sm font-medium text-[var(--color-text-secondary)]">
                CSV file
              </label>
              <input
                id="campaign-csv"
                name="campaign-csv"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => void handleFile(e.target.files?.[0])}
                className="block w-full text-sm text-[var(--color-text-secondary)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-bg-secondary)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 rounded-lg"
              />
              {csv && <p className="text-xs text-[var(--color-text-muted)]">Selected: {csv.fileName}</p>}
            </div>
          </div>
        ) : (
          <>
        <p className="text-xs text-[var(--color-text-muted)]">
          One SMS goes out per day, to every subscriber. Days are Bangladesh days (today is {today}); leave gaps if you like.
        </p>

        <ol className="space-y-4">
          {messages.map((m, i) => (
            <li key={m.key} className="space-y-2 rounded-xl border border-[var(--color-border)] p-3">
              <div className="flex items-end justify-between gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor={`campaign-day-${m.key}`}
                    className="block text-sm font-medium text-[var(--color-text-secondary)]"
                  >
                    Day {i + 1}
                  </label>
                  <input
                    id={`campaign-day-${m.key}`}
                    name={`campaign-day-${m.key}`}
                    type="date"
                    min={today}
                    value={m.day}
                    onChange={(e) => patch(m.key, { day: e.target.value })}
                    className={`${INPUT_CLASS} tabular-nums`}
                  />
                </div>
                {messages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setMessages((list) => list.filter((x) => x.key !== m.key))}
                    className="rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                    aria-label={`Remove message ${i + 1}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor={`campaign-body-${m.key}`}
                  className="block text-sm font-medium text-[var(--color-text-secondary)]"
                >
                  Message {i + 1}
                </label>
                <textarea
                  id={`campaign-body-${m.key}`}
                  name={`campaign-body-${m.key}`}
                  rows={3}
                  value={m.body}
                  onChange={(e) => patch(m.key, { body: e.target.value })}
                  placeholder="Write the SMS in English or Bengali…"
                  className={TEXTAREA_CLASS}
                />
                <PartCounter text={m.body} />
              </div>
            </li>
          ))}
        </ol>

        <Button
          type="button"
          variant="secondary"
          onClick={() => setMessages((list) => [...list, newDraft()])}
          disabled={messages.length >= SMS_MAX_CAMPAIGN_MESSAGES}
        >
          <Plus size={14} aria-hidden="true" /> Add another day
        </Button>

          </>
        )}

        {/* Error */}
        {error && (
          <div className="text-sm text-[var(--color-danger)]" role="alert">
            <p>{error}</p>
            {rowErrors.length > 1 && (
              <ul className="mt-1 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 overscroll-contain">
                {rowErrors.map((r, i) => (
                  <li key={i}>
                    Line <span className="tabular-nums">{r.line}</span>: {r.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" fullWidth onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" fullWidth loading={submitting}>
            {mode === 'csv' ? 'Import campaign' : 'Create campaign'}
          </Button>
        </div>
      </form>
    </div>
  )
}
