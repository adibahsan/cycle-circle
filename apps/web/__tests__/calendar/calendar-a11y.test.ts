import { describe, it, expect, afterEach } from 'vitest'
import { dayAccessibleName, gridKeyTarget } from '../../src/lib/calendar-a11y'
import { toDeviceDay } from '../../src/lib/local-date'

const plain = { isPeriod: false, isFertile: false, isOvulation: false, isFuturePredicted: false }
// Stand-in translator: the real labels live in i18n; these literals are the spec's state names.
const LABELS: Record<string, string> = {
  'calendar.period': 'Period',
  'calendar.predictedPeriod': 'Predicted period',
  'calendar.fertile': 'Fertile',
  'calendar.ovulationDay': 'Ovulation',
  'calendar.today': 'Today',
  'calendar.follicularPhase': 'Follicular phase',
  'calendar.lutealPhase': 'Luteal phase',
}
const t = (k: string) => LABELS[k] ?? k
const oct15 = new Date(2026, 9, 15)

describe('dayAccessibleName: full date plus every state, nothing colour-only', () => {
  it('a plain day announces just its full date', () => {
    expect(dayAccessibleName({ date: oct15, flags: plain, isToday: false, language: 'en' }, t)).toBe(
      'Thursday, October 15, 2026',
    )
  })
  it('a logged period day that is today announces both', () => {
    expect(
      dayAccessibleName({ date: oct15, flags: { ...plain, isPeriod: true }, isToday: true, language: 'en' }, t),
    ).toBe('Thursday, October 15, 2026, Period, Today')
  })
  it('a predicted period is not announced as a logged one', () => {
    expect(
      dayAccessibleName(
        { date: oct15, flags: { ...plain, isPeriod: true, isFuturePredicted: true }, isToday: false, language: 'en' },
        t,
      ),
    ).toBe('Thursday, October 15, 2026, Predicted period')
  })
  it('ovulation inside the fertile window announces both', () => {
    expect(
      dayAccessibleName(
        { date: oct15, flags: { ...plain, isFertile: true, isOvulation: true }, isToday: false, language: 'en' },
        t,
      ),
    ).toBe('Thursday, October 15, 2026, Fertile, Ovulation')
  })
  it('a tinted follicular or luteal day says its phase in words, before Today', () => {
    expect(dayAccessibleName({ date: oct15, flags: plain, phase: 'follicular', isToday: false, language: 'en' }, t)).toBe(
      'Thursday, October 15, 2026, Follicular phase',
    )
    expect(dayAccessibleName({ date: oct15, flags: plain, phase: 'luteal', isToday: true, language: 'en' }, t)).toBe(
      'Thursday, October 15, 2026, Luteal phase, Today',
    )
  })
  it('a period day in the luteal range is announced only as a period (the tint it shows)', () => {
    expect(
      dayAccessibleName({ date: oct15, flags: { ...plain, isPeriod: true }, phase: 'luteal', isToday: false, language: 'en' }, t),
    ).toBe('Thursday, October 15, 2026, Period')
  })
  it('Bengali names the date in Bengali, with no Latin letters or digits', () => {
    const name = dayAccessibleName({ date: oct15, flags: plain, isToday: false, language: 'bn' }, t)
    expect(name).not.toMatch(/[A-Za-z0-9]/)
    expect(name).toContain('১৫')
  })
})

describe('gridKeyTarget: date-grid keyboard moves (WAI-ARIA date picker)', () => {
  const ymd = (d: Date | null) =>
    d && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  it('left and right move one day, across a month edge', () => {
    expect(ymd(gridKeyTarget(oct15, 'ArrowRight'))).toBe('2026-10-16')
    expect(ymd(gridKeyTarget(new Date(2026, 9, 1), 'ArrowLeft'))).toBe('2026-09-30')
  })
  it('up and down move one week', () => {
    expect(ymd(gridKeyTarget(oct15, 'ArrowUp'))).toBe('2026-10-08')
    expect(ymd(gridKeyTarget(oct15, 'ArrowDown'))).toBe('2026-10-22')
  })
  it('Home and End go to the start and end of the week (Sunday-first)', () => {
    expect(ymd(gridKeyTarget(oct15, 'Home'))).toBe('2026-10-11')
    expect(ymd(gridKeyTarget(oct15, 'End'))).toBe('2026-10-17')
  })
  it('PageUp and PageDown change month, clamping to the last day', () => {
    expect(ymd(gridKeyTarget(oct15, 'PageUp'))).toBe('2026-09-15')
    expect(ymd(gridKeyTarget(oct15, 'PageDown'))).toBe('2026-11-15')
    expect(ymd(gridKeyTarget(new Date(2026, 9, 31), 'PageDown'))).toBe('2026-11-30')
  })
  it('other keys are not grid moves', () => {
    expect(gridKeyTarget(oct15, 'Enter')).toBeNull()
    expect(gridKeyTarget(oct15, 'Tab')).toBeNull()
  })
})

describe('toDeviceDay: the edit form opens on the day the user sees (UTC+6)', () => {
  afterEach(() => {
    process.env.TZ = 'UTC'
  })
  it('a Dhaka local-midnight date stays on its own day, not the UTC day before', () => {
    process.env.TZ = 'Asia/Dhaka'
    expect(toDeviceDay(new Date('2026-10-04T18:00:00.000Z'))).toBe('2026-10-05')
    expect(toDeviceDay('2026-10-04T18:00:00.000Z')).toBe('2026-10-05')
  })
  it('a stored UTC-midnight date is the same day in Dhaka', () => {
    process.env.TZ = 'Asia/Dhaka'
    expect(toDeviceDay(new Date('2026-10-05T00:00:00.000Z'))).toBe('2026-10-05')
  })
  it('a plain YYYY-MM-DD string passes through', () => {
    process.env.TZ = 'Asia/Dhaka'
    expect(toDeviceDay('2026-10-05')).toBe('2026-10-05')
  })
})
