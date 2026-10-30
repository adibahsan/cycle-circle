import { describe, expect, it } from 'vitest'
import {
  addDaysToDay,
  bangladeshDayOf,
  bangladeshToday,
  dayToStoredDate,
  daysBetween,
  storedDateToDay,
} from '../dhaka-date'

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

describe('bangladeshDayOf at the 18:00 UTC boundary', () => {
  it('17:59 UTC is still the same day, 18:00 UTC is the next', () => {
    expect(bangladeshDayOf(new Date('2026-06-10T17:59:59.999Z'))).toBe('2026-06-10')
    expect(bangladeshDayOf(new Date('2026-06-10T18:00:00.000Z'))).toBe('2026-06-11')
  })
})

describe('dayToStoredDate / storedDateToDay', () => {
  it('round-trips a day through its UTC-midnight Date', () => {
    expect(dayToStoredDate('2026-03-02').toISOString()).toBe('2026-03-02T00:00:00.000Z')
    expect(storedDateToDay(dayToStoredDate('2028-02-29'))).toBe('2028-02-29')
  })
  it('reads a stored date by its UTC date, ignoring the process timezone', () => {
    expect(storedDateToDay(new Date('2026-03-02T00:00:00.000Z'))).toBe('2026-03-02')
    expect(storedDateToDay(new Date('2026-03-02T23:59:59.999Z'))).toBe('2026-03-02')
  })
})

describe('addDaysToDay', () => {
  it('adds and subtracts within a month', () => {
    expect(addDaysToDay('2026-03-02', 0)).toBe('2026-03-02')
    expect(addDaysToDay('2026-03-02', 28)).toBe('2026-03-30')
    expect(addDaysToDay('2026-03-02', -1)).toBe('2026-03-01')
  })
  it('crosses month and year boundaries', () => {
    expect(addDaysToDay('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDaysToDay('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysToDay('2027-01-01', -1)).toBe('2026-12-31')
    expect(addDaysToDay('2026-03-01', -35)).toBe('2026-01-25')
  })
  it('handles leap days', () => {
    expect(addDaysToDay('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDaysToDay('2028-02-29', 1)).toBe('2028-03-01')
    expect(addDaysToDay('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDaysToDay('2028-03-01', -1)).toBe('2028-02-29')
  })
})

describe('daysBetween', () => {
  it('counts whole days, signed', () => {
    expect(daysBetween('2026-03-02', '2026-03-02')).toBe(0)
    expect(daysBetween('2026-03-02', '2026-03-30')).toBe(28)
    expect(daysBetween('2026-03-30', '2026-03-02')).toBe(-28)
  })
  it('spans month, year and leap days', () => {
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2)
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1)
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365)
    expect(daysBetween('2028-01-01', '2029-01-01')).toBe(366)
  })
  it('agrees with addDaysToDay', () => {
    expect(daysBetween('2026-11-05', addDaysToDay('2026-11-05', 400))).toBe(400)
  })
  it('measures Bangladesh days across the 18:00 UTC boundary', () => {
    const a = bangladeshDayOf(new Date('2026-06-10T17:59:00Z'))
    const b = bangladeshDayOf(new Date('2026-06-10T18:00:00Z'))
    expect(daysBetween(a, b)).toBe(1)
  })
})
