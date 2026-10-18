/**
 * Which cycle phase a calendar day falls in, from known period starts and the shared
 * phase ranges (`getPhaseRanges`), so the calendar tints follicular and luteal days with
 * the same boundaries as the dashboard. Dates are device-local YYYY-MM-DD strings.
 */
import { getPhaseRanges } from '@vesta/shared/utils/cycle-utils'
import type { CyclePhase } from '@vesta/shared/types'

const dayNumber = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

/**
 * The phase on `day`, counted from the latest start on or before it.
 * Null before the first known start, or past `cycleLength` (a late period is not guessed at).
 */
export function cyclePhaseOn(
  day: string,
  starts: string[],
  cycleLength: number,
  periodLength: number,
): CyclePhase | null {
  let latest: string | null = null
  for (const s of starts) if (s <= day && (!latest || s > latest)) latest = s
  if (!latest) return null
  const cycleDay = dayNumber(day) - dayNumber(latest) + 1
  if (cycleDay > cycleLength) return null
  return getPhaseRanges(cycleLength, periodLength).find((r) => r.days > 0 && cycleDay >= r.start && cycleDay <= r.end)?.phase ?? null
}

/** Logged starts plus the first day of every run of period days (logged or predicted), sorted and unique. */
export function periodStarts(logged: string[], days: { date: string; period: boolean }[]): string[] {
  const periodDays = new Set(days.filter((d) => d.period).map((d) => d.date))
  const out = new Set(logged)
  for (const date of periodDays) {
    if (!periodDays.has(ymdAdd(date, -1))) out.add(date)
  }
  return [...out].sort()
}

function ymdAdd(ymd: string, n: number): string {
  return new Date((dayNumber(ymd) + n) * 86_400_000).toISOString().slice(0, 10)
}
