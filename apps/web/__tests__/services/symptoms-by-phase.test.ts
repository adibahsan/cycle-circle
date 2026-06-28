import { describe, it, expect } from 'vitest'
import { phaseForLog } from '@vesta/shared/server/services'

// FR-ANALYTICS: symptoms-by-cycle-phase.
// Pure-function tests — no DB required.

const DAY = 86_400_000
const t0 = Date.UTC(2026, 0, 1)

describe('phaseForLog', () => {
  it('returns menstrual on cycle day 1 (log == period start)', () => {
    expect(phaseForLog(t0, [t0], 28, 5)).toBe('menstrual')
  })

  it('returns menstrual on cycle day 5 (last day of period)', () => {
    expect(phaseForLog(t0 + 4 * DAY, [t0], 28, 5)).toBe('menstrual')
  })

  it('returns follicular on cycle day 6 (first day after period)', () => {
    expect(phaseForLog(t0 + 5 * DAY, [t0], 28, 5)).toBe('follicular')
  })

  it('returns ovulation on cycle day 14', () => {
    expect(phaseForLog(t0 + 13 * DAY, [t0], 28, 5)).toBe('ovulation')
  })

  it('returns luteal on cycle day 21', () => {
    expect(phaseForLog(t0 + 20 * DAY, [t0], 28, 5)).toBe('luteal')
  })

  it('returns null when log precedes the only period start', () => {
    expect(phaseForLog(t0 - DAY, [t0], 28, 5)).toBeNull()
  })

  it('anchors to the most recent preceding period start when multiple starts exist', () => {
    // log is 1 day after the 2nd period start → cycle day 2 → menstrual
    expect(phaseForLog(t0 + 31 * DAY, [t0, t0 + 30 * DAY], 28, 5)).toBe('menstrual')
  })
})
