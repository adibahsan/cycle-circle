/**
 * Period logs of one profile must not share a day. Ranges are inclusive
 * 'yyyy-MM-dd' day strings, so lexicographic comparison is chronological.
 */
export interface DayRange {
  startDate: string
  endDate: string
}

export function findOverlappingPeriod<T extends DayRange & { id?: string }>(
  range: DayRange,
  others: readonly T[],
  excludeId?: string,
): T | null {
  for (const o of others) {
    if (excludeId !== undefined && o.id === excludeId) continue
    if (o.startDate <= range.endDate && o.endDate >= range.startDate) return o
  }
  return null
}

/** Day string of a stored period date (written as UTC midnight from 'yyyy-MM-dd'). */
export function periodDayKey(d: Date | string): string {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  return new Date(d).toISOString().slice(0, 10)
}
