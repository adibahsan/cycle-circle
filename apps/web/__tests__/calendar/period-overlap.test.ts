import { describe, it, expect } from 'vitest'
import { findOverlappingPeriod, periodDayKey } from '@vesta/shared/utils/period-overlap'

const A = { id: 'a', startDate: '2026-10-01', endDate: '2026-10-05' }

describe('findOverlappingPeriod', () => {
  const hit = (s: string, e: string, id?: string) => findOverlappingPeriod({ startDate: s, endDate: e }, [A], id)
  it('overlap at start', () => expect(hit('2026-09-28', '2026-10-01')).toBe(A))
  it('overlap at end (same-day touch)', () => expect(hit('2026-10-05', '2026-10-09')).toBe(A))
  it('inside', () => expect(hit('2026-10-02', '2026-10-03')).toBe(A))
  it('containing', () => expect(hit('2026-09-20', '2026-10-20')).toBe(A))
  it('adjacent days are fine', () => {
    expect(hit('2026-10-06', '2026-10-10')).toBeNull()
    expect(hit('2026-09-25', '2026-09-30')).toBeNull()
  })
  it('excludeId ignores self on edit', () => expect(hit('2026-10-02', '2026-10-06', 'a')).toBeNull())
  it('returns the first overlap', () => {
    const B = { id: 'b', startDate: '2026-10-03', endDate: '2026-10-08' }
    expect(findOverlappingPeriod({ startDate: '2026-10-04', endDate: '2026-10-04' }, [A, B])).toBe(A)
  })
})

describe('periodDayKey', () => {
  it('passes day strings through and reads UTC midnight', () => {
    expect(periodDayKey('2026-10-05')).toBe('2026-10-05')
    expect(periodDayKey(new Date('2026-10-05'))).toBe('2026-10-05')
  })
})
