'use client'

import { Badge } from '@/components/ui/Badge'
import { countSmsParts, SMS_PART_WARN_THRESHOLD, type SmsSendLanguage } from '@vesta/shared/utils/sms'
import { formatDhaka } from '@vesta/shared/utils/dhaka-date'

type Instant = Date | string

export type SmsMessage = {
  id: string
  campaignId: string
  /** Bangladesh day (a stored date: 00:00 UTC). A string once it has been through the admin cache. */
  day: Instant
  body: string
  status: string
  sentAt: Instant | null
  lastError: string | null
  sendAttempts: number
  audienceSize: number | null
  deliveredCount: number | null
  failedCount: number | null
}

export type SmsCampaign = {
  id: string
  name: string
  status: 'planned' | 'running' | 'finished' | 'cancelled'
  createdAt: Instant
  creator: { fullName: string | null; email: string | null }
  messages: SmsMessage[]
}

/** A stored date-only value to its Bangladesh `YYYY-MM-DD` day. */
export function dayText(day: Instant): string {
  return new Date(day).toISOString().slice(0, 10)
}

/** A Bangladesh day for display, e.g. "Nov 1, 2026". */
export function formatDay(day: Instant): string {
  return formatDhaka(day, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** A moment in Bangladesh time, e.g. "Nov 1, 2026, 02:00 PM". */
export function formatSentAt(at: Instant | null): string {
  if (!at) return '—'
  return formatDhaka(at, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Language picker + part counter ─────────────────────────────────────────

const LANGUAGE_OPTIONS: { value: SmsSendLanguage; label: string }[] = [
  { value: 'BOTH', label: 'Bengali + English' },
  { value: 'BN', label: 'Bengali only' },
  { value: 'EN', label: 'English only' },
]

export function LanguagePicker({
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

export function PartCounter({ text }: { text: string }) {
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

export function SendPreview({ body }: { body: string }) {
  return (
    <div className="mt-4 space-y-2 text-left">
      <p className="whitespace-pre-wrap rounded-lg bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
        {body}
      </p>
      <PartCounter text={body} />
    </div>
  )
}

export const TEXTAREA_CLASS =
  'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 focus-visible:border-[var(--color-primary)] transition-colors duration-200 resize-none'

type StatusVariant = 'info' | 'warning' | 'success' | 'danger' | 'neutral'

export function statusBadge(status: string) {
  const map: Record<string, { variant: StatusVariant; label: string }> = {
    // campaign (derived)
    planned: { variant: 'info', label: 'Planned' },
    running: { variant: 'warning', label: 'Running' },
    finished: { variant: 'success', label: 'Finished' },
    cancelled: { variant: 'neutral', label: 'Cancelled' },
    // message
    PLANNED: { variant: 'info', label: 'Planned' },
    SENDING: { variant: 'warning', label: 'Sending' },
    SENT: { variant: 'success', label: 'Sent' },
    FAILED: { variant: 'danger', label: 'Failed to send' },
    MISSED: { variant: 'neutral', label: 'Missed' },
    CANCELLED: { variant: 'neutral', label: 'Cancelled' },
  }
  const cfg = map[status] ?? { variant: 'neutral', label: status }
  return <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>
}
