import { addDaysToDay, storedDateToDay } from '@vesta/shared/utils/dhaka-date'

/** A stored date-only value (Date or ISO string) as its YYYY-MM-DD day. A stored date is read by its UTC day, never the device's. */
export function storedDay(value: Date | string): string {
  return storedDateToDay(value instanceof Date ? value : new Date(value))
}

/** Bounds for the "last period started" date inputs: up to the Bangladesh today, back 90 days. */
export function lastPeriodDateBounds(today: string): { min: string; max: string } {
  return { min: addDaysToDay(today, -90), max: today }
}

export type InsightsRange = '3m' | '6m' | '1y' | 'all'

/** First Bangladesh day inside the Insights range ending on `today`; null for "all". Clamps month ends (Mar 31 minus 1 month is Feb 28). */
export function insightsCutoffDay(range: InsightsRange, today: string): string | null {
  if (range === 'all') return null
  const months = range === '3m' ? 3 : range === '6m' ? 6 : 12
  const [y, m, d] = today.split('-').map(Number)
  const total = y * 12 + (m - 1) - months
  const ty = Math.floor(total / 12)
  const tm = total % 12
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate()
  return `${ty}-${String(tm + 1).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`
}
