/**
 * Admin date filters are Asia/Dhaka calendar days (UTC+6, no DST), inclusive.
 * `YYYY-MM-DD` (extra characters after the first 10 are ignored) becomes the
 * instant that day starts, or with `endOfDay` the last millisecond of that day.
 * Returns undefined for missing or invalid input.
 */
export function parseDhakaDay(value: string | undefined, endOfDay = false): Date | undefined {
  const day = value?.slice(0, 10)
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined
  const d = new Date(`${day}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+06:00`)
  // Reject days that don't exist (JS rolls 2026-02-31 over to March).
  const real = !Number.isNaN(d.getTime()) && new Date(d.getTime() + 6 * 3_600_000).toISOString().slice(0, 10) === day
  return real ? d : undefined
}

const BANGLADESH_OFFSET_MS = 6 * 3_600_000

/**
 * The Bangladesh calendar day (fixed UTC+6, no DST) an instant falls on, as `YYYY-MM-DD`.
 * Use this instead of `toISOString().slice(0, 10)` on a current instant, which lags a day
 * between 00:00 and 06:00 in Bangladesh.
 */
export function bangladeshDayOf(instant: Date): string {
  return new Date(instant.getTime() + BANGLADESH_OFFSET_MS).toISOString().slice(0, 10)
}

/** Today's Bangladesh day as `YYYY-MM-DD`. `now` is injectable for tests. */
export function bangladeshToday(now: Date = new Date()): string {
  return bangladeshDayOf(now)
}

// Bangladesh-day arithmetic. A day is a `YYYY-MM-DD` string; these helpers use UTC
// methods only, so they give the same answer in any process timezone.

const DAY_MS = 86_400_000

/** A `YYYY-MM-DD` day to its stored form: that day at 00:00 UTC (how date-only columns are written). */
export function dayToStoredDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`)
}

/** A stored date-only value (a Date at 00:00 UTC) back to its `YYYY-MM-DD` day. */
export function storedDateToDay(stored: Date): string {
  return stored.toISOString().slice(0, 10)
}

/** `day` plus `n` days (negative `n` goes back), as `YYYY-MM-DD`. Crosses month, year and leap days. */
export function addDaysToDay(day: string, n: number): string {
  return storedDateToDay(new Date(dayToStoredDate(day).getTime() + n * DAY_MS))
}

/** Whole days from `from` to `to` (`to` minus `from`; negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((dayToStoredDate(to).getTime() - dayToStoredDate(from).getTime()) / DAY_MS)
}

/**
 * Format an instant for display in Bangladesh time, with a fixed locale. Server and browser
 * render the same text whatever their own timezone or locale, so pages hydrate (React #418).
 */
export function formatDhaka(instant: Date | string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'Asia/Dhaka' }).format(new Date(instant))
}
