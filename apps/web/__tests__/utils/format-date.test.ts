import { describe, it, expect } from 'vitest'
import { formatShortDate } from '@/lib/format-date'
import { parseCyclePhase } from '@vesta/shared/utils/cycle-utils'

describe('formatShortDate', () => {
  const d = new Date(2026, 9, 8)
  it('matches the plain Intl short month + day', () => {
    expect(formatShortDate('en', d)).toBe(new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(d))
  })
  it('uses bn-BD for Bengali', () => {
    expect(formatShortDate('bn', d)).toBe(new Intl.DateTimeFormat('bn-BD', { month: 'short', day: 'numeric' }).format(d))
  })
})

describe('parseCyclePhase', () => {
  it('is case-insensitive and null for unknown names', () => {
    expect(parseCyclePhase('Menstrual')).toBe('menstrual')
    expect(parseCyclePhase('OVULATION')).toBe('ovulation')
    expect(parseCyclePhase('ovulatory')).toBeNull()
  })
})
