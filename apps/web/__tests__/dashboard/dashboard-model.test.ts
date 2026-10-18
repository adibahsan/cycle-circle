import { describe, it, expect } from 'vitest'
import { journeySteps, currentJourneyPhase, periodStatus, fertileStatus } from '@/app/(main)/dashboard/dashboard-model'

const shape = (cycle: number, period: number) => journeySteps(cycle, period).map((s) => [s.phase, s.start, s.end])

describe('journeySteps (cycle-journey stepper, #74)', () => {
  it('shows all four phases of a 28-day cycle with a 5-day period', () => {
    expect(shape(28, 5)).toEqual([
      ['menstrual', 1, 5],
      ['follicular', 6, 9],
      ['ovulation', 10, 15],
      ['luteal', 16, 28],
    ])
  })

  it('hides a phase with no days on a short cycle instead of showing 0 days', () => {
    expect(shape(21, 5)).toEqual([
      ['menstrual', 1, 5],
      ['ovulation', 6, 8],
      ['luteal', 9, 21],
    ])
  })

  it('hides two crowded-out phases when the period is long', () => {
    expect(shape(21, 14)).toEqual([
      ['menstrual', 1, 14],
      ['luteal', 15, 21],
    ])
  })

  for (let cycle = 21; cycle <= 45; cycle++) {
    for (let period = 1; period <= 14; period++) {
      it(`cycle ${cycle}, period ${period}: visible steps cover every day exactly once`, () => {
        const steps = journeySteps(cycle, period)
        expect(steps.reduce((s, r) => s + r.days, 0)).toBe(cycle)
        for (const s of steps) expect(s.days).toBeGreaterThan(0)
        steps.forEach((s, i) => expect(s.start).toBe(i === 0 ? 1 : steps[i - 1].end + 1))
      })
    }
  }
})

describe('currentJourneyPhase', () => {
  it('marks the phase the hero shows', () => {
    expect(currentJourneyPhase(journeySteps(28, 5), 'ovulation', 12)).toBe('ovulation')
  })
  it('falls back to the step holding today when the shown phase has no days', () => {
    // 21-day cycle, 5-day period: follicular has 0 days; day 7 sits in ovulation.
    expect(currentJourneyPhase(journeySteps(21, 5), 'follicular', 7)).toBe('ovulation')
  })
})

describe('periodStatus (next period stat)', () => {
  it('counts down to the next period', () => {
    expect(periodStatus(9)).toEqual({ kind: 'in', days: 9 })
  })
  it('is due today at 0', () => {
    expect(periodStatus(0)).toEqual({ kind: 'due' })
  })
  it('is late by the overdue day count', () => {
    expect(periodStatus(-3)).toEqual({ kind: 'late', days: 3 })
  })
  it('is unknown without a countdown', () => {
    expect(periodStatus(null)).toBeNull()
  })
})

describe('fertileStatus (fertile window stat)', () => {
  const start = '2026-10-20'
  const end = '2026-10-25'
  it('is open on its first day', () => {
    expect(fertileStatus('2026-10-20', start, end)).toEqual({ kind: 'open', until: end })
  })
  it('is open on its last day', () => {
    expect(fertileStatus('2026-10-25', start, end)).toEqual({ kind: 'open', until: end })
  })
  it('opens in N days before it starts', () => {
    expect(fertileStatus('2026-10-17', start, end)).toEqual({ kind: 'opens', days: 3, on: start })
  })
  it('counts across a month boundary', () => {
    expect(fertileStatus('2026-09-28', start, end)).toEqual({ kind: 'opens', days: 22, on: start })
  })
  it('is closed for this cycle after it ends', () => {
    expect(fertileStatus('2026-10-26', start, end)).toEqual({ kind: 'closed' })
  })
})
