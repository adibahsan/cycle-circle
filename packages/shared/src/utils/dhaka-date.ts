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
