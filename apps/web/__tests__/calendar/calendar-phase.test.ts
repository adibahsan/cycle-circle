import { describe, it, expect } from 'vitest'
import { cyclePhaseOn, periodStarts } from '../../src/lib/calendar-phase'

// 28-day cycle, 5-day period (worked by hand from getCurrentPhase's boundaries):
//   menstrual 1–5, follicular 6–9, ovulation 10–15, luteal 16–28.
const starts = ['2026-09-03', '2026-10-01']

describe('cyclePhaseOn: the phase a calendar day falls in', () => {
  it('names follicular and luteal days counted from the latest period start', () => {
    expect(cyclePhaseOn('2026-10-07', starts, 28, 5)).toBe('follicular')
    expect(cyclePhaseOn('2026-10-20', starts, 28, 5)).toBe('luteal')
    expect(cyclePhaseOn('2026-09-30', starts, 28, 5)).toBe('luteal') // day 28 of the September cycle
  })
  it('names menstrual and ovulation days too', () => {
    expect(cyclePhaseOn('2026-10-01', starts, 28, 5)).toBe('menstrual')
    expect(cyclePhaseOn('2026-10-12', starts, 28, 5)).toBe('ovulation')
  })
  it('is unknown before the first known start', () => {
    expect(cyclePhaseOn('2026-09-02', starts, 28, 5)).toBeNull()
  })
  it('is unknown past the cycle length (a late period is not invented as luteal)', () => {
    expect(cyclePhaseOn('2026-10-29', starts, 28, 5)).toBeNull()
  })
  it('follows the shared ranges on a short cycle: no follicular days at all', () => {
    // 21-day cycle, 7-day period: follicular end = 21-14-5 = 2 → clamped to the period end, 0 days.
    for (let d = 1; d <= 21; d++) {
      const day = `2026-10-${String(d).padStart(2, '0')}`
      expect(cyclePhaseOn(day, ['2026-10-01'], 21, 7)).not.toBe('follicular')
    }
  })
  it('does not depend on the order of the starts', () => {
    expect(cyclePhaseOn('2026-10-20', [...starts].reverse(), 28, 5)).toBe('luteal')
  })
})

describe('periodStarts: logged starts plus the first day of each period run', () => {
  it('takes the first day of each run of period days and merges logged starts', () => {
    const days = [
      { date: '2026-10-28', period: true },
      { date: '2026-10-29', period: true },
      { date: '2026-10-30', period: false },
      { date: '2026-11-25', period: true },
    ]
    expect(periodStarts(['2026-10-01', '2026-10-28'], days)).toEqual(['2026-10-01', '2026-10-28', '2026-11-25'])
  })
  it('a run continuing from the day before is not a new start', () => {
    const days = [
      { date: '2026-10-02', period: true },
      { date: '2026-10-01', period: true },
    ]
    expect(periodStarts([], days)).toEqual(['2026-10-01'])
  })
})
