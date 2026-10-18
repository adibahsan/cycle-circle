'use client'

import { Badge } from '@/components/ui/Badge'
import { composeSms, countSmsParts, SMS_PART_WARN_THRESHOLD, type SmsSendLanguage } from '@vesta/shared/utils/sms'

export type SmsBroadcast = {
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

/** Date → `yyyy-MM-ddTHH:mm` in local time, the DateTimePicker's value shape. */
export function toLocalInput(d: Date | null) {
  if (!d) return ''
  const x = new Date(d)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`
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

export function SendPreview({ broadcast }: { broadcast: SmsBroadcast }) {
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

export const TEXTAREA_CLASS =
  'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 focus-visible:border-[var(--color-primary)] transition-colors duration-200 resize-none'

type StatusVariant = 'info' | 'warning' | 'success' | 'danger' | 'neutral'

export function statusBadge(status: string) {
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
