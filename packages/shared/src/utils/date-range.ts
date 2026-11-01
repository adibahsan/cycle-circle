import { addDaysToDay, bangladeshToday, daysBetween, parseDhakaDay } from './dhaka-date'

/**
 * The one range model for admin dashboards: a preset (7/30/90 days) or a custom from-to in
 * Bangladesh days, kept in the URL (`?range=7d` or `?from=YYYY-MM-DD&to=YYYY-MM-DD`).
 * Pure: takes `now` (ADR 0009). Days are Bangladesh days (ADR 0008).
 */

export const DATE_RANGE_PRESETS = ['7d', '30d', '90d'] as const
export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number]
export const DEFAULT_RANGE_PRESET: DateRangePreset = '30d'
export const MAX_RANGE_DAYS = 366

/** URL param names, so pages and the UI control agree. */
export const RANGE_PARAMS = { preset: 'range', from: 'from', to: 'to' } as const

export interface DayWindow {
  /** First Bangladesh day, `YYYY-MM-DD`. */
  fromDay: string
  /** Last Bangladesh day, `YYYY-MM-DD`, inclusive. */
  toDay: string
  /** Instant the first day starts (inclusive). */
  from: Date
  /** Last millisecond of the last Bangladesh day (inclusive), so today is whole. */
  to: Date
  /** Number of Bangladesh days, inclusive. */
  days: number
}

export interface DateRange extends DayWindow {
  kind: 'preset' | 'custom'
  preset: DateRangePreset | null
  /** The previous period of equal length, ending the day before `fromDay`. */
  previous: DayWindow
  /** Stable cache key within one Bangladesh day: `fromDay_toDay`. */
  key: string
  /** Set when the URL asked for something invalid; the range then falls back to the default preset. */
  error?: string
}

type RawParams = Record<string, string | string[] | undefined>

function first(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v
  return s === '' ? undefined : s
}

function windowOf(fromDay: string, toDay: string): DayWindow {
  return {
    fromDay,
    toDay,
    from: parseDhakaDay(fromDay)!,
    to: parseDhakaDay(toDay, true)!,
    days: daysBetween(fromDay, toDay) + 1,
  }
}

function build(fromDay: string, toDay: string, preset: DateRangePreset | null, error?: string): DateRange {
  const w = windowOf(fromDay, toDay)
  const previous = windowOf(addDaysToDay(fromDay, -w.days), addDaysToDay(fromDay, -1))
  return {
    ...w,
    kind: preset ? 'preset' : 'custom',
    preset,
    previous,
    key: `${fromDay}_${toDay}`,
    ...(error ? { error } : {}),
  }
}

function presetRange(preset: DateRangePreset, today: string, error?: string): DateRange {
  const days = Number.parseInt(preset, 10)
  return build(addDaysToDay(today, -(days - 1)), today, preset, error)
}

const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && parseDhakaDay(v) !== undefined

export function parseDateRange(params: RawParams, now: Date): DateRange {
  const today = bangladeshToday(now)
  const from = first(params[RANGE_PARAMS.from])
  const to = first(params[RANGE_PARAMS.to])

  if (from !== undefined || to !== undefined) {
    const fail = (message: string) => presetRange(DEFAULT_RANGE_PRESET, today, message)
    if (from === undefined || to === undefined) return fail('Pick both a start and an end day.')
    if (!isDay(from) || !isDay(to)) return fail('Use days written as YYYY-MM-DD.')
    if (from > today) return fail('The start day must not be in the future.')
    const toDay = to > today ? today : to
    if (from > toDay) return fail('The start day must not be after the end day.')
    if (daysBetween(from, toDay) + 1 > MAX_RANGE_DAYS) return fail(`Pick a range of ${MAX_RANGE_DAYS} days or fewer.`)
    return build(from, toDay, null)
  }

  const raw = first(params[RANGE_PARAMS.preset])
  const preset = DATE_RANGE_PRESETS.find((p) => p === raw) ?? DEFAULT_RANGE_PRESET
  return presetRange(preset, today)
}

/** URL params that reproduce `range`; pages and the UI control write these. */
export function rangeToParams(range: Pick<DateRange, 'kind' | 'preset' | 'fromDay' | 'toDay'>): Record<string, string> {
  return range.kind === 'custom' || !range.preset
    ? { [RANGE_PARAMS.from]: range.fromDay, [RANGE_PARAMS.to]: range.toDay }
    : { [RANGE_PARAMS.preset]: range.preset }
}
