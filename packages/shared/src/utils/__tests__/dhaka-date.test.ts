import { describe, expect, it } from 'vitest'
import { bangladeshDayOf, bangladeshToday } from '../dhaka-date'

describe('bangladeshDayOf', () => {
  it('returns the Bangladesh day when UTC day lags (00:00-06:00 Dhaka)', () => {
    // 00:00 Dhaka on the 2nd is still the 1st in UTC
    expect(bangladeshDayOf(new Date('2026-03-01T18:00:00Z'))).toBe('2026-03-02')
    expect(bangladeshDayOf(new Date('2026-03-01T23:59:59.999Z'))).toBe('2026-03-02')
  })
  it('keeps the same day from 06:00 UTC onward only until Dhaka midnight', () => {
    expect(bangladeshDayOf(new Date('2026-03-02T05:59:59.999Z'))).toBe('2026-03-02')
    expect(bangladeshDayOf(new Date('2026-03-02T17:59:59.999Z'))).toBe('2026-03-02')
    expect(bangladeshDayOf(new Date('2026-03-02T18:00:00Z'))).toBe('2026-03-03')
  })
  it('rolls over month and year boundaries', () => {
    expect(bangladeshDayOf(new Date('2026-12-31T20:00:00Z'))).toBe('2027-01-01')
    expect(bangladeshDayOf(new Date('2028-02-28T18:00:00Z'))).toBe('2028-02-29')
  })
})

describe('bangladeshToday', () => {
  it('uses the injected instant', () => {
    expect(bangladeshToday(new Date('2026-10-24T19:30:00Z'))).toBe('2026-10-25')
  })
  it('defaults to the current instant', () => {
    expect(bangladeshToday()).toBe(bangladeshDayOf(new Date()))
  })
})
