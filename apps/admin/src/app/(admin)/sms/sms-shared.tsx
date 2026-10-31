'use client'

import { Badge } from '@/components/ui/Badge'
import { countSmsParts, SMS_PART_WARN_THRESHOLD, SMS_MAX_PARTS } from '@vesta/shared/utils/sms'
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

// ─── Results ──────────────────────────────────────────────────────────────────

/**
 * What a sent message achieved. Delivered/failed counts are null when delivery reports were not
 * requested for that send, which the admin shows as "delivery reports off", never as zeros.
 */
export function messageResult(m: Pick<SmsMessage, 'audienceSize' | 'deliveredCount' | 'failedCount'>) {
  const reports = m.deliveredCount !== null || m.failedCount !== null
  return {
    audience: m.audienceSize,
    reports,
    delivered: m.deliveredCount ?? 0,
    failed: m.failedCount ?? 0,
  }
}

/** Campaign totals over its messages: sent, failed to send, audience reached, and report counts. */
export function campaignTotals(messages: SmsMessage[]) {
  const sentMessages = messages.filter((m) => m.status === 'SENT')
  const results = sentMessages.map(messageResult)
  return {
    sent: sentMessages.length,
    failedToSend: messages.filter((m) => m.status === 'FAILED').length,
    audience: results.reduce((n, r) => n + (r.audience ?? 0), 0),
    reports: results.some((r) => r.reports),
    delivered: results.reduce((n, r) => n + r.delivered, 0),
    failed: results.reduce((n, r) => n + r.failed, 0),
  }
}

export const DELIVERY_REPORTS_OFF = 'Delivery reports off'

/** The audience/delivered/failed cell for one message (nothing for a message that was not sent). */
export function ResultCell({ message }: { message: SmsMessage }) {
  if (message.status !== 'SENT') return <span className="text-[var(--color-text-muted)]">—</span>
  const r = messageResult(message)
  return (
    <div className="space-y-0.5 text-xs tabular-nums text-[var(--color-text-secondary)]" data-testid="message-result">
      <p>Audience: {r.audience ?? '—'}</p>
      {r.reports ? (
        <p>
          Delivered {r.delivered} · Failed {r.failed}
        </p>
      ) : (
        <p className="text-[var(--color-text-muted)]">{DELIVERY_REPORTS_OFF}</p>
      )}
    </div>
  )
}

/** Campaign totals line(s) for the list and detail. */
export function TotalsLines({ messages }: { messages: SmsMessage[] }) {
  const t = campaignTotals(messages)
  if (t.sent === 0 && t.failedToSend === 0) return null
  return (
    <div className="space-y-0.5 text-xs tabular-nums text-[var(--color-text-muted)]" data-testid="campaign-totals">
      <p>
        {t.sent} sent · {t.failedToSend} failed to send · audience {t.audience}
      </p>
      <p>{t.reports ? `Delivered ${t.delivered} · Failed ${t.failed}` : DELIVERY_REPORTS_OFF}</p>
    </div>
  )
}

// ─── Part counter ─────────────────────────────────────────────────────────────

export function PartCounter({ text }: { text: string }) {
  const { encoding, parts, charsLeft } = countSmsParts(text)
  const warn = parts > SMS_PART_WARN_THRESHOLD
  const tooLong = parts > SMS_MAX_PARTS
  return (
    <div className="space-y-1" aria-live="polite">
      <p className={`text-xs tabular-nums ${warn ? 'text-[var(--color-warning)] font-medium' : 'text-[var(--color-text-muted)]'}`}>
        {parts} SMS part{parts !== 1 ? 's' : ''} · {encoding === 'UCS2' ? 'Unicode (Bengali), 70/67 per part' : 'GSM-7, 160/153 per part'} · {charsLeft} left in this part
      </p>
      {tooLong && (
        <p className="text-xs font-medium text-[var(--color-danger)]">
          Too long: the limit is {SMS_MAX_PARTS} SMS parts. Shorten the message to plan it.
        </p>
      )}
      {warn && !tooLong && (
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
