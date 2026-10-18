import { getPhaseRanges, type PhaseRange } from '@vesta/shared/utils/cycle-utils'
import type { CyclePhase } from '@vesta/shared/types'

/**
 * The cycle-journey stepper's steps: the shared phase ranges without phases a short cycle or long
 * period crowds out to 0 days. The visible steps still cover every cycle day exactly once.
 */
export function journeySteps(cycleLength: number, periodLength: number): PhaseRange[] {
  return getPhaseRanges(cycleLength, periodLength).filter((r) => r.days > 0)
}

/** The step to mark current: the hero's phase, or the step holding today if that phase is hidden. */
export function currentJourneyPhase(steps: PhaseRange[], phase: CyclePhase, cycleDay: number): CyclePhase | null {
  if (steps.some((s) => s.phase === phase)) return phase
  return steps.find((s) => cycleDay >= s.start && cycleDay <= s.end)?.phase ?? null
}

export type PeriodStatus = { kind: 'in'; days: number } | { kind: 'due' } | { kind: 'late'; days: number }

/** Next-period stat from the countdown in days (negative = overdue). */
export function periodStatus(daysUntilNext: number | null): PeriodStatus | null {
  if (daysUntilNext == null) return null
  if (daysUntilNext > 0) return { kind: 'in', days: daysUntilNext }
  if (daysUntilNext === 0) return { kind: 'due' }
  return { kind: 'late', days: -daysUntilNext }
}

export type FertileStatus = { kind: 'open'; until: string } | { kind: 'opens'; days: number; on: string } | { kind: 'closed' }

const dayNumber = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

/** Fertile window stat; all dates are YYYY-MM-DD calendar days (today on the device clock). */
export function fertileStatus(today: string, start: string, end: string): FertileStatus {
  const t = dayNumber(today)
  if (t < dayNumber(start)) return { kind: 'opens', days: dayNumber(start) - t, on: start }
  if (t <= dayNumber(end)) return { kind: 'open', until: end }
  return { kind: 'closed' }
}

export type DashboardHeroState = 'pregnancy' | 'menopause' | 'no-period' | 'cycle'

/**
 * Which hero (and which blocks) the dashboard renders. `pregnantGoal` is the client-side goal
 * fallback for the pregnancy flag. #76 fills in the menopause and no-period heroes.
 */
export function dashboardHeroState(
  mode: 'standard' | 'pregnancy' | 'menopause',
  hasPeriod: boolean,
  pregnantGoal = false,
): DashboardHeroState {
  if (mode === 'pregnancy' || pregnantGoal) return 'pregnancy'
  if (mode === 'menopause') return 'menopause'
  return hasPeriod ? 'cycle' : 'no-period'
}
