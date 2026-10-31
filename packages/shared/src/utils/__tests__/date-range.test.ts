import { describe, it, expect } from 'vitest'
import { parseDateRange, MAX_RANGE_DAYS, rangeToParams } from '../date-range'

// 2026-11-01 02:00 in Bangladesh = 2026-10-31 20:00Z (the 18:00-24:00 UTC window, #220).
const NOW = new Date('2026-10-31T20:00:00Z')

describe('parseDateRange presets', () => {
  it('defaults to the last 30 Bangladesh days ending today, inclusive', () => {
    const r = parseDateRange({}, NOW)
    expect(r).toMatchObject({ kind: 'preset', preset: '30d', fromDay: '2026-10-03', toDay: '2026-11-01', days: 30 })
    expect(r.error).toBeUndefined()
  })

  it.each([
    ['7d', '2026-10-26', 7],
    ['30d', '2026-10-03', 30],
    ['90d', '2026-08-04', 90],
  ])('%s covers %i days ending today', (preset, fromDay, days) => {
    const r = parseDateRange({ range: preset }, NOW)
    expect(r).toMatchObject({ kind: 'preset', preset, fromDay, toDay: '2026-11-01', days })
  })

  it('reads the first value of an array param and ignores unknown presets', () => {
    expect(parseDateRange({ range: ['7d', '90d'] }, NOW).days).toBe(7)
    const r = parseDateRange({ range: '1y' }, NOW)
    expect(r.preset).toBe('30d')
    expect(r.error).toBeUndefined()
  })
})

describe('parseDateRange end of Bangladesh day (#220)', () => {
  it("includes today's 02:00 Bangladesh activity: `to` is the last ms of the Bangladesh day", () => {
    const r = parseDateRange({ range: '7d' }, NOW)
    expect(r.to.toISOString()).toBe('2026-11-01T17:59:59.999Z')
    expect(r.from.toISOString()).toBe('2026-10-25T18:00:00.000Z')
    const logAt0200 = new Date('2026-10-31T20:00:00Z')
    expect(logAt0200 >= r.from && logAt0200 <= r.to).toBe(true)
  })

  it('does not include the first moment of the next Bangladesh day', () => {
    const r = parseDateRange({}, NOW)
    expect(new Date('2026-11-01T18:00:00Z') > r.to).toBe(true)
  })
})

describe('parseDateRange custom', () => {
  it('takes from/to as Bangladesh days', () => {
    const r = parseDateRange({ from: '2026-10-01', to: '2026-10-31' }, NOW)
    expect(r).toMatchObject({ kind: 'custom', preset: null, fromDay: '2026-10-01', toDay: '2026-10-31', days: 31 })
    expect(r.from.toISOString()).toBe('2026-09-30T18:00:00.000Z')
    expect(r.to.toISOString()).toBe('2026-10-31T17:59:59.999Z')
  })

  it('accepts a single day and exactly 366 days', () => {
    expect(parseDateRange({ from: '2026-10-05', to: '2026-10-05' }, NOW).days).toBe(1)
    const r = parseDateRange({ from: '2025-11-01', to: '2026-11-01' }, NOW)
    expect(r.days).toBe(MAX_RANGE_DAYS)
    expect(r.error).toBeUndefined()
  })

  it('refuses more than 366 days with a message and falls back to the default preset', () => {
    const r = parseDateRange({ from: '2025-10-31', to: '2026-11-01' }, NOW)
    expect(r.error).toBe('Pick a range of 366 days or fewer.')
    expect(r).toMatchObject({ kind: 'preset', preset: '30d', days: 30 })
  })

  it('clamps a future end day to today', () => {
    const r = parseDateRange({ from: '2026-10-20', to: '2026-12-31' }, NOW)
    expect(r).toMatchObject({ kind: 'custom', toDay: '2026-11-01', days: 13 })
    expect(r.error).toBeUndefined()
  })

  it.each([
    [{ from: '2026-10-01' }, 'Pick both a start and an end day.'],
    [{ to: '2026-10-01' }, 'Pick both a start and an end day.'],
    [{ from: '2026-10-31', to: '2026-10-01' }, 'The start day must not be after the end day.'],
    [{ from: '2026-11-05', to: '2026-11-09' }, 'The start day must not be in the future.'],
    [{ from: 'nope', to: '2026-10-01' }, 'Use days written as YYYY-MM-DD.'],
    [{ from: '2026-02-31', to: '2026-03-02' }, 'Use days written as YYYY-MM-DD.'],
  ])('refuses %j with a message', (params, error) => {
    const r = parseDateRange(params, NOW)
    expect(r.error).toBe(error)
    expect(r.kind).toBe('preset')
    expect(r.days).toBe(30)
  })

  it('custom from/to wins over a preset in the same URL', () => {
    expect(parseDateRange({ range: '7d', from: '2026-10-01', to: '2026-10-10' }, NOW).kind).toBe('custom')
  })

  it('treats empty strings as absent', () => {
    const r = parseDateRange({ from: '', to: '' }, NOW)
    expect(r.error).toBeUndefined()
    expect(r.preset).toBe('30d')
  })
})

describe('parseDateRange previous period', () => {
  it('is the same number of days ending the day before the range starts', () => {
    const r = parseDateRange({ from: '2026-10-01', to: '2026-10-31' }, NOW)
    expect(r.previous).toMatchObject({ fromDay: '2026-08-31', toDay: '2026-09-30', days: 31 })
    expect(r.previous.from.toISOString()).toBe('2026-08-30T18:00:00.000Z')
    expect(r.previous.to.toISOString()).toBe('2026-09-30T17:59:59.999Z')
  })

  it('for a preset', () => {
    const r = parseDateRange({ range: '7d' }, NOW)
    expect(r.previous).toMatchObject({ fromDay: '2026-10-19', toDay: '2026-10-25', days: 7 })
  })

  it('crosses a leap day and year boundary', () => {
    const r = parseDateRange({ from: '2024-03-01', to: '2024-03-10' }, new Date('2026-01-01T00:00:00Z'))
    expect(r.previous).toMatchObject({ fromDay: '2024-02-20', toDay: '2024-02-29', days: 10 })
  })
})

describe('parseDateRange keys and params', () => {
  it('key is stable within a Bangladesh day and changes the next day', () => {
    const a = parseDateRange({}, new Date('2026-10-31T18:00:00Z')).key
    const b = parseDateRange({}, new Date('2026-11-01T17:59:00Z')).key
    const c = parseDateRange({}, new Date('2026-11-01T18:00:00Z')).key
    expect(a).toBe(b)
    expect(c).not.toBe(a)
  })

  it('rangeToParams round-trips both kinds', () => {
    const custom = parseDateRange({ from: '2026-10-01', to: '2026-10-31' }, NOW)
    expect(rangeToParams(custom)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(parseDateRange(rangeToParams(custom), NOW).fromDay).toBe('2026-10-01')
    const preset = parseDateRange({ range: '90d' }, NOW)
    expect(rangeToParams(preset)).toEqual({ range: '90d' })
  })
})
