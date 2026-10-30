import { describe, it, expect } from 'vitest'
import { bangladeshToday } from '@vesta/shared/utils/dhaka-date'
import { insightsCutoffDay, lastPeriodDateBounds, storedDay } from '@/lib/day-ranges'

// 18:30 UTC is 00:30 the next day in Bangladesh; 23:59 UTC is 05:59 the next day.
const LATE_EVENING_UTC = new Date('2026-10-04T18:30:00.000Z')
const NEARLY_MIDNIGHT_UTC = new Date('2026-10-04T23:59:00.000Z')

describe('lastPeriodDateBounds', () => {
  it('allows the Bangladesh today and not tomorrow, even when the device (UTC) is still on the day before', () => {
    const today = bangladeshToday(LATE_EVENING_UTC)
    expect(today).toBe('2026-10-05')
    expect(lastPeriodDateBounds(today).max).toBe('2026-10-05')
    expect(bangladeshToday(NEARLY_MIDNIGHT_UTC)).toBe('2026-10-05')
  })
  it('reaches back 90 days from the Bangladesh today', () => {
    expect(lastPeriodDateBounds('2026-10-05').min).toBe('2026-07-07')
    expect(lastPeriodDateBounds('2026-03-01').min).toBe('2025-12-01')
  })
})

describe('insightsCutoffDay', () => {
  it('counts months back from the Bangladesh today', () => {
    expect(insightsCutoffDay('3m', bangladeshToday(LATE_EVENING_UTC))).toBe('2026-07-05')
    expect(insightsCutoffDay('6m', '2026-10-05')).toBe('2026-04-05')
    expect(insightsCutoffDay('1y', '2026-10-05')).toBe('2025-10-05')
  })
  it('clamps to the end of a shorter month', () => {
    expect(insightsCutoffDay('3m', '2026-05-31')).toBe('2026-02-28')
    expect(insightsCutoffDay('1y', '2028-02-29')).toBe('2027-02-28')
  })
  it('crosses a year boundary', () => {
    expect(insightsCutoffDay('3m', '2026-01-15')).toBe('2025-10-15')
  })
  it('has no cutoff for all time', () => {
    expect(insightsCutoffDay('all', '2026-10-05')).toBeNull()
  })
})

describe('storedDay', () => {
  it('reads a stored date by its UTC day, not the process timezone', () => {
    expect(storedDay(new Date('2026-10-05T00:00:00.000Z'))).toBe('2026-10-05')
    expect(storedDay('2026-10-05T00:00:00.000Z')).toBe('2026-10-05')
    expect(storedDay('2026-10-05')).toBe('2026-10-05')
  })
})
