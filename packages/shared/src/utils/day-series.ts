import {
  addDaysToDay,
  bangladeshDayOf,
  daysBetween,
  parseDhakaDay,
} from './dhaka-date'

export interface DaySeriesOpts {
  days?: number
  dateFrom?: Date
  dateTo?: Date
  /** The current moment, read once at the edge (ADR 0009). Used only when `dateTo` is absent. */
  now: Date
}

export interface DaySeriesRange {
  /** First Bangladesh day of the series, `YYYY-MM-DD`. */
  fromDay: string
  /** Last Bangladesh day of the series, `YYYY-MM-DD`. */
  toDay: string
  /** Instant the first day starts (inclusive). */
  from: Date
  /** Last millisecond of the last day (inclusive). */
  to: Date
}

/**
 * Resolve an admin chart range to whole Bangladesh days.
 * `dateTo` defaults to `now`; `dateFrom` defaults to `days` days ending on the last day (inclusive).
 */
export function resolveDaySeriesRange(opts: DaySeriesOpts): DaySeriesRange {
  const { days = 30, dateFrom, dateTo, now } = opts
  const toDay = bangladeshDayOf(dateTo ?? now)
  const fromDay = dateFrom ? bangladeshDayOf(dateFrom) : addDaysToDay(toDay, -(days - 1))
  return {
    fromDay,
    toDay,
    from: parseDhakaDay(fromDay)!,
    to: parseDhakaDay(toDay, true)!,
  }
}

/**
 * Mean count over the series days on or after `firstDay` (when recording began), so days from
 * before recording are not averaged in as zeros. Null when no day qualifies.
 */
export function averageSince(series: { date: string; count: number }[], firstDay: string | null): number | null {
  if (!firstDay) return null
  const days = series.filter((d) => d.date >= firstDay)
  if (!days.length) return null
  return days.reduce((a, d) => a + d.count, 0) / days.length
}

/** One `{date, count}` row per Bangladesh day from `fromDay` to `toDay`, zero where `counts` has no entry. */
export function fillDaySeries(
  fromDay: string,
  toDay: string,
  counts: ReadonlyMap<string, number>,
): { date: string; count: number }[] {
  const total = daysBetween(fromDay, toDay)
  const result: { date: string; count: number }[] = []
  for (let i = 0; i <= total; i++) {
    const date = addDaysToDay(fromDay, i)
    result.push({ date, count: counts.get(date) ?? 0 })
  }
  return result
}
