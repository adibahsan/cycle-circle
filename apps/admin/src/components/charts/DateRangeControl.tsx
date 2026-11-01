'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  DATE_RANGE_PRESETS,
  RANGE_PARAMS,
  parseDateRange,
  type DateRange,
} from '@vesta/shared/utils/date-range'

/**
 * The shared date-range control: 7/30/90-day presets plus a custom from-to in Bangladesh days
 * (366 days at most). It writes `?range=` or `?from=&to=` and leaves every other param alone.
 * The page passes the range it parsed (`parseDateRange`); `error` shows why a URL range was refused.
 */
export type DateRangeControlValue = Pick<DateRange, 'kind' | 'preset' | 'fromDay' | 'toDay' | 'error'>

const BUTTON =
  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1'
const INPUT =
  'rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-1 text-xs ' +
  'text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'

export function DateRangeControl({ range, className }: { range: DateRangeControlValue; className?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [customOpen, setCustomOpen] = useState(range.kind === 'custom')
  const [from, setFrom] = useState(range.fromDay)
  const [to, setTo] = useState(range.toDay)
  const [localError, setLocalError] = useState<string | null>(null)

  function push(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const key of Object.values(RANGE_PARAMS)) params.delete(key)
    // A new range changes the row count, so any page number in the URL no longer means anything.
    params.delete('page')
    for (const [k, v] of Object.entries(updates)) if (v) params.set(k, v)
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  function applyCustom() {
    // The same parser the server uses decides, so the message matches what a pasted URL would show.
    const parsed = parseDateRange({ from, to }, new Date())
    if (parsed.error) {
      setLocalError(parsed.error)
      return
    }
    setLocalError(null)
    push({ [RANGE_PARAMS.from]: parsed.fromDay, [RANGE_PARAMS.to]: parsed.toDay })
  }

  const error = localError ?? range.error
  const showCustom = customOpen || range.kind === 'custom'

  return (
    <div className={['flex flex-col items-end gap-2', className ?? ''].join(' ').trim()}>
      <div
        role="group"
        aria-label="Date range"
        className="flex flex-wrap items-center gap-0.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-0.5"
      >
        {DATE_RANGE_PRESETS.map((preset) => {
          const active = range.kind === 'preset' && range.preset === preset
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setLocalError(null)
                setCustomOpen(false)
                if (!active) push({ [RANGE_PARAMS.preset]: preset })
              }}
              className={[
                BUTTON,
                active
                  ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-soft'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
              ].join(' ')}
            >
              {preset}
            </button>
          )
        })}
        <button
          type="button"
          aria-pressed={range.kind === 'custom'}
          aria-expanded={showCustom}
          onClick={() => setCustomOpen((o) => !o)}
          className={[
            BUTTON,
            range.kind === 'custom'
              ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-soft'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
          ].join(' ')}
        >
          Custom
        </button>
      </div>

      {showCustom && (
        <form
          className="flex flex-wrap items-end justify-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            applyCustom()
          }}
        >
          <label className="flex flex-col gap-1 text-[10px] font-medium text-[var(--color-text-muted)]" htmlFor="range-from">
            From
            <input id="range-from" name="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={INPUT} />
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-medium text-[var(--color-text-muted)]" htmlFor="range-to">
            To
            <input id="range-to" name="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className={INPUT} />
          </label>
          <button type="submit" className={[BUTTON, 'border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)]'].join(' ')}>
            Apply
          </button>
        </form>
      )}

      <p className="text-[11px] tabular-nums text-[var(--color-text-muted)]">
        {range.fromDay} to {range.toDay} (Bangladesh days)
      </p>
      <p role="alert" aria-live="polite" className="min-h-0 text-xs text-[var(--color-danger)]">
        {error ?? ''}
      </p>
    </div>
  )
}
