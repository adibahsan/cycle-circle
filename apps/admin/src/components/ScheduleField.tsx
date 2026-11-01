'use client'

import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { dhakaDateTimeToInstant } from '@vesta/shared/utils/dhaka-date'

/** Editor-only status for "published, at a future time". Saved as status PUBLISHED + a publish time. */
export const SCHEDULED = 'SCHEDULED'

/**
 * The publish-time input of the article editors. The wall time is Bangladesh time whatever the
 * browser's timezone is. Returns an error message, or the ISO instant to send.
 */
export function scheduleToIso(value: string): { error: string } | { iso: string } {
  const at = dhakaDateTimeToInstant(value)
  if (!at) return { error: 'Choose a publish date and time.' }
  if (at.getTime() <= Date.now()) return { error: 'The publish time must be in the future. Use Published to publish now.' }
  return { iso: at.toISOString() }
}

export function ScheduleField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5 pt-1">
      <label htmlFor="article-publish-at" className="block text-xs font-medium text-[var(--color-text-secondary)]">
        Publish at (Bangladesh time)
      </label>
      <DateTimePicker id="article-publish-at" value={value} onChange={onChange} aria-label="Publish date and time" />
      <p className="text-xs text-[var(--color-text-muted)]">
        Goes live at this time, Bangladesh time (UTC+6). Until then it stays hidden from readers.
      </p>
    </div>
  )
}
