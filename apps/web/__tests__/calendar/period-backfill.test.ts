import { describe, it, expect } from 'vitest'
import { canLogPastPeriod } from '../../src/app/(main)/calendar/period-backfill'

const today = '2026-10-25'
const p = (startDate: string, endDate: string) => ({ startDate, endDate })

describe('canLogPastPeriod', () => {
  it('yesterday with no periods is eligible', () => {
    expect(canLogPastPeriod('2026-10-24', today, [])).toBe(true)
  })
  it('today is not eligible', () => {
    expect(canLogPastPeriod(today, today, [])).toBe(false)
  })
  it('tomorrow is not eligible', () => {
    expect(canLogPastPeriod('2026-10-26', today, [])).toBe(false)
  })
  it('days at start, middle and end of a period are not eligible', () => {
    const periods = [p('2026-10-10', '2026-10-14')]
    expect(canLogPastPeriod('2026-10-10', today, periods)).toBe(false)
    expect(canLogPastPeriod('2026-10-12', today, periods)).toBe(false)
    expect(canLogPastPeriod('2026-10-14', today, periods)).toBe(false)
  })
  it('the day before the start and the day after the end are eligible', () => {
    const periods = [p('2026-10-10', '2026-10-14')]
    expect(canLogPastPeriod('2026-10-09', today, periods)).toBe(true)
    expect(canLogPastPeriod('2026-10-15', today, periods)).toBe(true)
  })
  it('has no 30-day limit', () => {
    expect(canLogPastPeriod('2026-04-08', today, [])).toBe(true)
  })
  it('checks every period', () => {
    const periods = [p('2026-09-01', '2026-09-05'), p('2026-10-01', '2026-10-05')]
    expect(canLogPastPeriod('2026-09-03', today, periods)).toBe(false)
    expect(canLogPastPeriod('2026-10-03', today, periods)).toBe(false)
    expect(canLogPastPeriod('2026-09-20', today, periods)).toBe(true)
  })
})
