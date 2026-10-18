import { describe, it, expect } from 'vitest'
import { parseDhakaDay } from '@vesta/shared/utils/dhaka-date'

describe('parseDhakaDay', () => {
  it('start of day is Dhaka midnight (previous day 18:00 UTC)', () => {
    expect(parseDhakaDay('2026-03-10')?.toISOString()).toBe('2026-03-09T18:00:00.000Z')
  })

  it('end of day is Dhaka 23:59:59.999 (same day 17:59:59.999 UTC)', () => {
    expect(parseDhakaDay('2026-03-10', true)?.toISOString()).toBe('2026-03-10T17:59:59.999Z')
  })

  it('the 00:00-05:59 Dhaka edge falls on its own Dhaka day, not the previous UTC day', () => {
    const from = parseDhakaDay('2026-03-10')!
    const to = parseDhakaDay('2026-03-10', true)!
    const dhaka0130 = new Date('2026-03-09T19:30:00Z') // 01:30 on 10 March in Dhaka
    expect(dhaka0130 >= from && dhaka0130 <= to).toBe(true)
    const dhaka2330Prev = new Date('2026-03-09T17:30:00Z') // 23:30 on 9 March in Dhaka
    expect(dhaka2330Prev < from).toBe(true)
  })

  it('accepts a longer ISO string by its first 10 characters', () => {
    expect(parseDhakaDay('2026-03-10T09:00:00Z')?.toISOString()).toBe('2026-03-09T18:00:00.000Z')
  })

  it('rejects malformed or impossible dates', () => {
    expect(parseDhakaDay(undefined)).toBeUndefined()
    expect(parseDhakaDay('')).toBeUndefined()
    expect(parseDhakaDay('10/03/2026')).toBeUndefined()
    expect(parseDhakaDay('2026-02-31')).toBeUndefined()
  })
})
