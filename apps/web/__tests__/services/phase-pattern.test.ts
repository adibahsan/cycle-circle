import { describe, it, expect } from 'vitest'
import { rankPhasePattern } from '@vesta/shared/server/services'

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
