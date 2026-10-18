/**
 * Calendar day styles: each day state has exactly one visual meaning.
 *   logged period    solid fill
 *   predicted period dashed outline
 *   fertile          soft tint, no border
 *   ovulation        solid mint/teal
 *   follicular       faint pink tint (phase from the shared ranges; any state above wins)
 *   luteal           faint lavender tint
 *   today            TODAY_GLOW: offset goal-accent ring + soft glow (additive, drawn by the cell)
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
    background: 'color-mix(in oklab, var(--color-fertile) var(--day-mix-fertile), var(--color-bg-card))',
    border: 'none',
    color: 'var(--color-text-primary)',
  },
  ovulation: { background: 'var(--color-ovulation)', border: 'none', color: 'var(--color-on-ovulation)' },
  follicular: {
    background: 'color-mix(in oklab, var(--color-follicular) var(--day-mix-phase), var(--color-bg-card))',
    border: 'none',
    color: 'var(--color-text-primary)',
  },
  luteal: {
    background: 'color-mix(in oklab, var(--color-luteal) var(--day-mix-phase), var(--color-bg-card))',
    border: 'none',
    color: 'var(--color-text-primary)',
  },
  plain: { background: 'transparent', border: 'none', color: 'var(--color-text-primary)' },
}

/**
 * Today's marker on every day grid (calendar, symptoms): a card-coloured gap, a goal-accent ring and a
 * soft glow. It sits outside the cell so it reads on any fill and stays distinct from the inset selected ring.
 */
const TODAY_ACCENT = 'var(--goal-accent, var(--color-primary))'
export const TODAY_GLOW = [
  '0 0 0 2px var(--color-bg-card)',
  `0 0 0 4px ${TODAY_ACCENT}`,
  `0 6px 18px -4px color-mix(in srgb, ${TODAY_ACCENT} 55%, transparent)`,
].join(', ')
/** The legend swatch for today, scaled to a 16px square. */
export const TODAY_GLOW_SWATCH = `0 0 0 1.5px var(--color-bg-card), 0 0 0 3px ${TODAY_ACCENT}`
