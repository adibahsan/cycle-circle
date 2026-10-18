import { describe, it, expect } from 'vitest'
import { journeySteps, currentJourneyPhase, periodStatus, fertileStatus, dashboardHeroState, dashboardBlocks, daysSince, calendarDay } from '@/app/(main)/dashboard/dashboard-model'

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

describe('dashboardHeroState (which hero renders)', () => {
  it('pregnancy mode wins over everything', () => {
    expect(dashboardHeroState('pregnancy', true)).toBe('pregnancy')
    expect(dashboardHeroState('standard', true, true)).toBe('pregnancy')
  })
  it('menopause mode has its own hero', () => {
    expect(dashboardHeroState('menopause', true)).toBe('menopause')
  })
  it('standard mode without a logged period asks for one', () => {
    expect(dashboardHeroState('standard', false)).toBe('no-period')
  })
  it('standard mode with a period shows the cycle hero', () => {
    expect(dashboardHeroState('standard', true)).toBe('cycle')
  })
})

describe('dashboardBlocks (what each mode renders, #76)', () => {
  it('cycle: live stepper and ring, phase tools', () => {
    expect(dashboardBlocks('cycle')).toEqual({ cycle: 'live', phaseTools: true })
  })
  it('pregnancy: no stepper, ring or phase tools', () => {
    expect(dashboardBlocks('pregnancy')).toEqual({ cycle: null, phaseTools: false })
  })
  it('menopause: no stepper, ring or phase tools', () => {
    expect(dashboardBlocks('menopause')).toEqual({ cycle: null, phaseTools: false })
  })
  it('no period: the stepper and ring show the example, with no phase tools', () => {
    expect(dashboardBlocks('no-period')).toEqual({ cycle: 'example', phaseTools: false })
  })
})

describe('daysSince (menopause hero: days since last period)', () => {
  it('is 0 on the day the period started', () => {
    expect(daysSince('2026-10-18', '2026-10-18')).toBe(0)
  })
  it('counts calendar days across a month boundary', () => {
    expect(daysSince('2026-10-18', '2026-09-20')).toBe(28)
  })
  it('never goes negative for a future start', () => {
    expect(daysSince('2026-10-18', '2026-10-20')).toBe(0)
  })
})

describe('calendarDay (dates from the cached dashboard data)', () => {
  it('reads a Date, an ISO timestamp string (cache round-trip) and a plain day the same way', () => {
    expect(calendarDay(new Date('2026-09-28T00:00:00.000Z'))).toBe('2026-09-28')
    expect(calendarDay('2026-09-28T00:00:00.000Z')).toBe('2026-09-28')
    expect(calendarDay('2026-09-28')).toBe('2026-09-28')
  })

  it('gives daysSince a whole number for a cached timestamp', () => {
    expect(daysSince('2026-10-18', calendarDay('2026-09-28T02:11:17.637Z'))).toBe(20)
  })
})
