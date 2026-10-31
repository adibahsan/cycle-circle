import { describe, it, expect } from 'vitest'
import { averageSince } from '../day-series'

const series = [
  { date: '2038-03-01', count: 0 },
  { date: '2038-03-02', count: 0 },
  { date: '2038-03-03', count: 4 },
  { date: '2038-03-04', count: 2 },
]

describe('averageSince', () => {
  it('averages only the days on or after the first recorded day', () => {
    expect(averageSince(series, '2038-03-03')).toBe(3)
  })

  it('averages the whole series when recording began before it', () => {
    expect(averageSince(series, '2038-01-01')).toBe(1.5)
  })

  it('is unavailable when recording had not begun, or never has', () => {
    expect(averageSince(series, '2038-03-05')).toBeNull()
    expect(averageSince(series, null)).toBeNull()
    expect(averageSince([], '2038-03-01')).toBeNull()
  })
})
