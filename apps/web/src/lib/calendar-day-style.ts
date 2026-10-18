/**
 * Calendar day styles: each day state has exactly one visual meaning.
 *   logged period    solid fill
 *   predicted period dashed outline
 *   fertile          soft tint, no border
 *   ovulation        solid mint/teal
 *   follicular       faint pink tint (phase from the shared ranges; any state above wins)
 *   luteal           faint lavender tint
 *   today            ring (additive, drawn by the cell)
 *   unlogged past    plain number, "+" on hover/focus (drawn by the cell)
 * Tints are mixed over the card surface (not transparent) so dark mode stays clean.
 */
import type { CyclePhase } from '@vesta/shared/types'

export type DayStyleKind = 'period' | 'predictedPeriod' | 'fertile' | 'ovulation' | 'follicular' | 'luteal' | 'plain'

export interface DayStateFlags {
  isPeriod: boolean
  isFertile: boolean
  isOvulation: boolean
  isFuturePredicted: boolean
}

export interface DayStyle {
  background: string
  border: string
  color: string
}

/** `phase` (from `cyclePhaseOn`) only adds the follicular/luteal tints; period, fertile and ovulation come from the data. */
export function dayStyleKind(m: DayStateFlags, phase?: CyclePhase | null): DayStyleKind {
  if (m.isPeriod) return m.isFuturePredicted ? 'predictedPeriod' : 'period'
  if (m.isOvulation) return 'ovulation'
  if (m.isFertile) return 'fertile'
  if (phase === 'follicular' || phase === 'luteal') return phase
  return 'plain'
}

export const DAY_STYLES: Record<DayStyleKind, DayStyle> = {
  period: { background: 'var(--color-menstrual)', border: 'none', color: 'var(--color-on-menstrual)' },
  predictedPeriod: {
    background: 'transparent',
    border: '1.5px dashed var(--color-menstrual)',
    color: 'var(--color-text-primary)',
  },
  fertile: {
    background: 'color-mix(in oklab, var(--color-fertile) 38%, var(--color-bg-card))',
    border: 'none',
    color: 'var(--color-text-primary)',
  },
  ovulation: { background: 'var(--color-ovulation)', border: 'none', color: 'var(--color-on-ovulation)' },
  follicular: {
    background: 'color-mix(in oklab, var(--color-follicular) 16%, var(--color-bg-card))',
    border: 'none',
    color: 'var(--color-text-primary)',
  },
  luteal: {
    background: 'color-mix(in oklab, var(--color-luteal) 16%, var(--color-bg-card))',
    border: 'none',
    color: 'var(--color-text-primary)',
  },
  plain: { background: 'transparent', border: 'none', color: 'var(--color-text-primary)' },
}
