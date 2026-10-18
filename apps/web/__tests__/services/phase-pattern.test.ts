import { describe, it, expect } from 'vitest'
import { dashboardCycleState, rankPhasePattern, rankRecentSymptoms, SYMPTOM_PATTERN_DAYS } from '@vesta/shared/server/services'

// Phase pattern (#75): the symptoms a profile logged most often in a phase,
// across its completed past cycles. Pure-function tests — no DB required.

const DAY = 86_400_000
const t0 = Date.UTC(2026, 0, 1)
const day = (n: number) => t0 + (n - 1) * DAY // cycle day n of the first cycle
const log = (ms: number, symptomId: string) => ({ dateMs: ms, symptomId })

describe('rankPhasePattern', () => {
  it('is empty before the profile has one completed cycle', () => {
    expect(
      rankPhasePattern({
        phase: 'menstrual',
        periodStartsMsAsc: [t0],
        periodLength: 5,
        symptomLogs: [log(day(1), 'cramps'), log(day(2), 'cramps')],
      }),
    ).toEqual([])
  })
  // Two completed 28-day cycles (days 1-5 menstrual, 6-9 follicular,
  // 10-15 ovulation, 16-28 luteal), then an open third cycle.
  const starts = [t0, t0 + 28 * DAY, t0 + 56 * DAY]
  const c2 = (n: number) => t0 + 28 * DAY + (n - 1) * DAY

  it('ranks symptoms in the phase by count across completed cycles', () => {
    const symptomLogs = [
      log(day(1), 'cramps'),
      log(day(2), 'cramps'),
      log(day(2), 'fatigue'),
      log(c2(1), 'cramps'),
      log(c2(3), 'fatigue'),
      log(c2(4), 'headache'),
      log(day(20), 'bloating'), // luteal — not counted for menstrual
    ]
    expect(
      rankPhasePattern({ phase: 'menstrual', periodStartsMsAsc: starts, periodLength: 5, symptomLogs }),
    ).toEqual([
      { symptomId: 'cramps', count: 3 },
      { symptomId: 'fatigue', count: 2 },
      { symptomId: 'headache', count: 1 },
    ])
    expect(
      rankPhasePattern({ phase: 'luteal', periodStartsMsAsc: starts, periodLength: 5, symptomLogs }),
    ).toEqual([{ symptomId: 'bloating', count: 1 }])
  })

  it('ignores logs in the current open cycle and before the first period', () => {
    const symptomLogs = [log(t0 + 56 * DAY, 'cramps'), log(t0 - DAY, 'cramps'), log(day(1), 'acne')]
    expect(
      rankPhasePattern({ phase: 'menstrual', periodStartsMsAsc: starts, periodLength: 5, symptomLogs }),
    ).toEqual([{ symptomId: 'acne', count: 1 }])
  })

  it('ignores "All good" check-ins', () => {
    const symptomLogs = [log(day(1), 'all_good'), log(day(2), 'all_good')]
    expect(
      rankPhasePattern({ phase: 'menstrual', periodStartsMsAsc: starts, periodLength: 5, symptomLogs }),
    ).toEqual([])
  })

  it("uses each completed cycle's own length for its phase boundaries", () => {
    // A 35-day cycle: ovulation day 21 → ovulation phase is days 17-22.
    const longStarts = [t0, t0 + 35 * DAY]
    const symptomLogs = [log(day(18), 'egg-white')]
    expect(
      rankPhasePattern({ phase: 'ovulation', periodStartsMsAsc: longStarts, periodLength: 5, symptomLogs }),
    ).toEqual([{ symptomId: 'egg-white', count: 1 }])
  })

  it('breaks ties by symptom id and caps the list at the limit', () => {
    const symptomLogs = ['nausea', 'acne', 'headache', 'cramps'].map((id) => log(day(1), id))
    expect(
      rankPhasePattern({ phase: 'menstrual', periodStartsMsAsc: starts, periodLength: 5, symptomLogs }),
    ).toEqual([
      { symptomId: 'acne', count: 1 },
      { symptomId: 'cramps', count: 1 },
      { symptomId: 'headache', count: 1 },
    ])
  })
})

// The card ranks the phase the dashboard shows: a log on cycle day N of a
// completed cycle counts under the same phase the dashboard names for day N.
describe('dashboard phase and Phase pattern agree', () => {
  const DAY_MS = 86_400_000
  const start = Date.UTC(2026, 0, 1)
  const starts = [start, start + 28 * DAY_MS]
  const phases = ['menstrual', 'follicular', 'ovulation', 'luteal'] as const

  it('names each cycle day with the phase its logs are ranked under', () => {
    for (let n = 1; n <= 28; n++) {
      const { phase } = dashboardCycleState({
        lastStartMs: start,
        todayMs: start + (n - 1) * DAY_MS,
        periodLength: 5,
        cycleLength: 28,
      })
      const symptomLogs = [{ dateMs: start + (n - 1) * DAY_MS, symptomId: 'cramps' }]
      const rankedUnder = phases.filter(
        (p) => rankPhasePattern({ phase: p, periodStartsMsAsc: starts, periodLength: 5, symptomLogs }).length > 0,
      )
      expect(rankedUnder, `cycle day ${n}`).toEqual([phase])
    }
  })

  it('a 28-day cycle reads menstrual 1-5, follicular 6-9, ovulation 10-15, luteal 16-28', () => {
    const at = (n: number) =>
      dashboardCycleState({ lastStartMs: start, todayMs: start + (n - 1) * DAY_MS, periodLength: 5, cycleLength: 28 })
    expect([1, 5, 6, 9, 10, 15, 16, 28].map((n) => at(n).phase)).toEqual([
      'menstrual', 'menstrual', 'follicular', 'follicular', 'ovulation', 'ovulation', 'luteal', 'luteal',
    ])
    expect(at(12).cycleDay).toBe(12)
  })

  it('caps the cycle day at the cycle length when the period is late', () => {
    expect(
      dashboardCycleState({ lastStartMs: start, todayMs: start + 40 * DAY_MS, periodLength: 5, cycleLength: 28 }),
    ).toEqual({ cycleDay: 28, phase: 'luteal' })
  })
})

// Menopause / perimenopause (#66 S1, story 18): no phases, so the hero's symptom pattern is the
// symptoms logged most often over a recent window.
describe('rankRecentSymptoms', () => {
  const today = Date.UTC(2026, 5, 30)
  const daysAgo = (n: number) => today - n * DAY

  it('looks back 90 days', () => {
    expect(SYMPTOM_PATTERN_DAYS).toBe(90)
  })

  it('ranks symptoms logged in the window by count, ties by id, capped at three', () => {
    const symptomLogs = [
      log(daysAgo(1), 'hot-flashes'),
      log(daysAgo(3), 'hot-flashes'),
      log(daysAgo(40), 'insomnia'),
      log(daysAgo(89), 'insomnia'),
      log(daysAgo(10), 'hot-flashes'),
      log(daysAgo(5), 'headache'),
      log(daysAgo(6), 'anxiety'),
    ]
    expect(rankRecentSymptoms({ todayMs: today, symptomLogs })).toEqual([
      { symptomId: 'hot-flashes', count: 3 },
      { symptomId: 'insomnia', count: 2 },
      { symptomId: 'anxiety', count: 1 },
    ])
  })

  it('ignores logs older than the window, future logs and "All good" check-ins', () => {
    const symptomLogs = [log(daysAgo(90), 'insomnia'), log(today + DAY, 'acne'), log(daysAgo(2), 'all_good'), log(today, 'fatigue')]
    expect(rankRecentSymptoms({ todayMs: today, symptomLogs })).toEqual([{ symptomId: 'fatigue', count: 1 }])
  })

  it('is empty with nothing logged', () => {
    expect(rankRecentSymptoms({ todayMs: today, symptomLogs: [] })).toEqual([])
  })
})
