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

export type RingCaption = { key: 'ringToNext'; days: number } | { key: 'ringExpected' }

/**
 * The progress ring's caption: a countdown while the period is ahead, otherwise a neutral
 * "period expected". The late day count stays in the hero's next-period stat only.
 */
export function ringCaption(period: PeriodStatus | null): RingCaption | null {
  if (!period) return null
  return period.kind === 'in' ? { key: 'ringToNext', days: period.days } : { key: 'ringExpected' }
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
 * fallback for the pregnancy flag.
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

export interface DashboardBlocks {
  /** The cycle-journey stepper and progress ring: real data, a dimmed 28-day example, or hidden. */
  cycle: 'live' | 'example' | null
  /** Phase-specific copy and links (e.g. articles filtered by the current phase). */
  phaseTools: boolean
  /** The toolkit's Log period card. Off when the first-run hero already offers the one Log period button. */
  logPeriodTool: boolean
}

/**
 * Blocks per hero state. Pregnancy and menopause hide the stepper and ring (their heroes
 * carry no fertile stat or predictions); with no period logged there is no real phase, so the stepper and ring show an example.
 */
export function dashboardBlocks(state: DashboardHeroState): DashboardBlocks {
  switch (state) {
    case 'cycle':
      return { cycle: 'live', phaseTools: true, logPeriodTool: true }
    case 'no-period':
      return { cycle: 'example', phaseTools: false, logPeriodTool: false }
    default:
      return { cycle: null, phaseTools: false, logPeriodTool: true }
  }
}

/** Where a profile is in its cycle: what the journey stepper and progress ring draw. */
export interface CyclePosition {
  cycleLength: number
  periodLength: number
  cycleDay: number
  phase: CyclePhase
}

/** The example cycle the no-period stepper and ring draw (not the user's data). */
export const EXAMPLE_CYCLE: CyclePosition = { cycleLength: 28, periodLength: 5, cycleDay: 8, phase: 'follicular' }

/** Whole calendar days from `start` to `today` (both YYYY-MM-DD), never negative. */
export function daysSince(today: string, start: string): number {
  return Math.max(0, dayNumber(today) - dayNumber(start))
}

/**
 * YYYY-MM-DD for a dashboard date. Server data arrives as a Date, or as an ISO
 * timestamp string once it has round-tripped through the data cache.
 */
export function calendarDay(d: Date | string): string {
  return (typeof d === 'string' ? d : d.toISOString()).slice(0, 10)
}
