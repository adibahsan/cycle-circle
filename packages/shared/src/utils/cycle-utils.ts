import { differenceInDays, addDays, format, startOfDay } from 'date-fns';
import type { CyclePhase, PredictionTier, UserProfile, Prediction } from '../types/types';

/** Milliseconds in a calendar day (UTC; no DST). */
export const MS_PER_DAY = 86_400_000;

export function getCurrentCycleDay(lastPeriodStart: string, cycleLength: number): number {
  const today = startOfDay(new Date());
  const lastPeriod = startOfDay(new Date(lastPeriodStart));
  const daysSince = differenceInDays(today, lastPeriod);
  return Math.min(daysSince + 1, cycleLength);
}

export function getCurrentPhase(cycleDay: number, periodLength: number, cycleLength: number): CyclePhase {
  if (cycleDay <= periodLength) return 'menstrual';
  const ovulationDay = cycleLength - 14;
  if (cycleDay < ovulationDay - 4) return 'follicular';
  if (cycleDay <= ovulationDay + 1) return 'ovulation';
  return 'luteal';
}

export interface PhaseRange {
  phase: CyclePhase;
  /** First cycle day of the phase (1-based). When `days` is 0, `start` is `end + 1`. */
  start: number;
  /** Last cycle day of the phase, inclusive. */
  end: number;
  days: number;
}

/**
 * Day ranges for each phase, in cycle order, using the same boundaries as
 * `getCurrentPhase`. Lengths always sum to `cycleLength`; a phase that a long
 * period or short cycle crowds out gets 0 days, never a negative count.
 */
export function getPhaseRanges(cycleLength: number, periodLength: number): PhaseRange[] {
  const ovulationDay = cycleLength - 14;
  const clamp = (day: number, floor: number) => Math.min(cycleLength, Math.max(floor, day));
  const menstrualEnd = clamp(periodLength, 0);
  const follicularEnd = clamp(ovulationDay - 5, menstrualEnd);
  const ovulationEnd = clamp(ovulationDay + 1, follicularEnd);
  const ends: [CyclePhase, number][] = [
    ['menstrual', menstrualEnd],
    ['follicular', follicularEnd],
    ['ovulation', ovulationEnd],
    ['luteal', cycleLength],
  ];
  let prevEnd = 0;
  return ends.map(([phase, end]) => {
    const range = { phase, start: prevEnd + 1, end, days: end - prevEnd };
    prevEnd = end;
    return range;
  });
}

export function getDaysUntilNextPeriod(cycleDay: number, cycleLength: number): number {
  return cycleLength - cycleDay;
}

export function predictCycleLength(history: number[], fallback = 28): number {
  if (history.length === 0) return fallback;
  if (history.length === 1) return history[0];
  const weights = history.map((_, i) => i + 1);
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  const weightedSum = history.reduce((s, v, i) => s + v * weights[i], 0);
  return Math.round(weightedSum / totalWeight);
}

export function getPredictionTier(cycleCount: number): PredictionTier {
  if (cycleCount >= 6) return 'arima';
  return 'average';
}

export function getConfidence(tier: PredictionTier, cycleCount: number): number {
  if (tier === 'arima') return Math.min(92, 70 + cycleCount * 2);
  return Math.min(75, 40 + cycleCount * 8);
}

/** Map API phase names to client CyclePhase (e.g. ovulatory → ovulation). */
export function normalizeCyclePhase(phase: string): CyclePhase {
  if (phase === 'ovulatory') return 'ovulation';
  return phase as CyclePhase;
}

export function computePrediction(profile: UserProfile): Prediction {
  const predictedLength = predictCycleLength(profile.cycleHistory, profile.cycleLength);
  const lastPeriod = new Date(profile.lastPeriodStart);
  const nextPeriodStart = addDays(lastPeriod, predictedLength);
  const ovulationDay = addDays(nextPeriodStart, -14);
  const fertileStart = addDays(ovulationDay, -5);
  const fertileEnd = addDays(ovulationDay, 1);
  const tier = getPredictionTier(profile.cycleHistory.length);
  const confidence = getConfidence(tier, profile.cycleHistory.length);

  return {
    profileId: profile.id,
    tier,
    nextPeriodStart: format(nextPeriodStart, 'yyyy-MM-dd'),
    ovulationDay: format(ovulationDay, 'yyyy-MM-dd'),
    fertileStart: format(fertileStart, 'yyyy-MM-dd'),
    fertileEnd: format(fertileEnd, 'yyyy-MM-dd'),
    confidence,
  };
}

const CYCLE_PHASES: readonly CyclePhase[] = ['menstrual', 'follicular', 'ovulation', 'luteal'];

/** Case-insensitive parse of a phase name (e.g. an article tag); null when it is not a known phase. */
export function parseCyclePhase(value: string): CyclePhase | null {
  const v = value.toLowerCase();
  return CYCLE_PHASES.find((p) => p === v) ?? null;
}

export function getPhaseColor(phase: CyclePhase): string {
  switch (phase) {
    case 'menstrual': return 'var(--color-menstrual)';
    case 'follicular': return 'var(--color-follicular)';
    case 'ovulation': return 'var(--color-ovulation)';
    case 'luteal': return 'var(--color-luteal)';
  }
}

export function getPhaseEmoji(phase: CyclePhase): string {
  switch (phase) {
    case 'menstrual': return '🩸';
    case 'follicular': return '🌱';
    case 'ovulation': return '🌸';
    case 'luteal': return '🌙';
  }
}
