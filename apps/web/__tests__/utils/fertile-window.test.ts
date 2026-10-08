import { describe, it, expect } from 'vitest'
import { selectFertileWindow } from '@vesta/shared/utils/fertile-window'

const d = (date: string, fertile = false) => ({ date, fertile })
const run = (start: string, n: number) => {
  const out = []
  const base = new Date(`${start}T00:00:00Z`)
  for (let i = 0; i < n; i++) {
    const x = new Date(base)
    x.setUTCDate(base.getUTCDate() + i)
    out.push(d(x.toISOString().slice(0, 10), true))
  }
  return out
}

describe('selectFertileWindow', () => {
  const twoWindows = [...run('2026-10-01', 2), d('2026-10-03'), d('2026-10-04'), ...run('2026-10-26', 5)]

  it('picks only the run containing today when a month spans two windows', () => {
    expect(selectFertileWindow(twoWindows, '2026-10-02')).toEqual({ start: '2026-10-01', end: '2026-10-02' })
  })

  it('picks the next upcoming run when today is between windows', () => {
    expect(selectFertileWindow(twoWindows, '2026-10-10')).toEqual({ start: '2026-10-26', end: '2026-10-30' })
  })

  it('shows the last run when today is after all windows', () => {
    expect(selectFertileWindow(twoWindows, '2026-11-20')).toEqual({ start: '2026-10-26', end: '2026-10-30' })
  })

  it('returns null with no fertile days', () => {
    expect(selectFertileWindow([d('2026-10-01'), d('2026-10-02')], '2026-10-01')).toBeNull()
    expect(selectFertileWindow([], '2026-10-01')).toBeNull()
  })

  it('handles unsorted input', () => {
    expect(selectFertileWindow([...twoWindows].reverse(), '2026-10-10')).toEqual({ start: '2026-10-26', end: '2026-10-30' })
  })
})
