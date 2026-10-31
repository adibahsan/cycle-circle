'use client'

import { useState, useTransition } from 'react'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { setCronEnabledAction, setReportRecipientsAction } from '@/app/actions/system-actions'

/** Recipients and the on/off switch for the emailed weekly and monthly Overview reports. */
export function ReportsCard({ initialRecipients, initialEnabled }: { initialRecipients: string[]; initialEnabled: boolean }) {
  const initialText = initialRecipients.join('\n')
  const [saved, setSaved] = useState(initialText)
  const [value, setValue] = useState(initialText)
  const [enabled, setEnabled] = useState(initialEnabled)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [toggling, startToggle] = useTransition()
  const toast = useToast()
  const dirty = value.trim() !== saved.trim()

  function save() {
    setError(null)
    start(async () => {
      const res = await setReportRecipientsAction(value)
      if (res.ok) {
        const text = res.emails.join('\n')
        setSaved(text)
        setValue(text)
        toast.success(res.emails.length === 0 ? 'Report recipients cleared' : `Reports will go to ${res.emails.length} recipient${res.emails.length === 1 ? '' : 's'}`)
      } else {
        setError(res.error)
      }
    })
  }

  function toggle() {
    const next = !enabled
    setEnabled(next)
    startToggle(async () => {
      const res = await setCronEnabledAction('reports', next)
      if (!res.ok) setEnabled(!next)
    })
  }

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--color-text-primary)]">
        <Mail size={16} aria-hidden="true" />
        Emailed reports
      </h2>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        The Overview numbers with % change, the CSV attached and a link to the Overview. The weekly report covers the previous
        7 Bangladesh days and goes out every Sunday at 09:00 Bangladesh time. The monthly report covers the previous calendar
        month and goes out on the 1st.
      </p>
      <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
        Production schedule: Sunday 03:00 UTC (weekly), 1st of the month 03:00 UTC (monthly). With no recipients, nothing is sent.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs font-medium text-[var(--color-text-muted)]">Schedule</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Schedule for Emailed reports"
          disabled={toggling}
          onClick={toggle}
          className={[
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
            'transition-colors focus-visible:outline-none focus-visible:ring-2',
            'focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            enabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border-strong)]',
          ].join(' ')}
        >
          <span
            aria-hidden="true"
            className={[
              'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
              enabled ? 'translate-x-5' : 'translate-x-0',
            ].join(' ')}
          />
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="report-recipients" className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
            Recipients (one email per line, or separated by commas)
          </label>
          <textarea
            id="report-recipients"
            name="reportRecipients"
            rows={3}
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={error !== null}
            aria-describedby={error ? 'report-recipients-error' : undefined}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-[var(--color-text-primary)] transition-colors focus-visible:border-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30"
          />
        </div>
        <Button size="sm" onClick={save} loading={pending} disabled={!dirty || pending}>
          Save recipients
        </Button>
      </div>
      {error && (
        <p id="report-recipients-error" role="alert" className="mt-2 text-sm font-medium text-[var(--color-danger)]">
          {error}
        </p>
      )}
    </Card>
  )
}
