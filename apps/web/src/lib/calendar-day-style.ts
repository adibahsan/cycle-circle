/**
 * Calendar day styles: each day state has exactly one visual meaning.
 *   logged period    solid fill
 *   predicted period dashed outline
 *   fertile          soft tint, no border
 *   ovulation        solid gold
 *   today            ring (additive, drawn by the cell)
 *   unlogged past    plain number, "+" on hover/focus (drawn by the cell)
 * Tints are mixed over the card surface (not transparent) so dark mode stays clean.
 */
export type DayStyleKind = 'period' | 'predictedPeriod' | 'fertile' | 'ovulation' | 'plain'

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

export function dayStyleKind(m: DayStateFlags): DayStyleKind {
  if (m.isPeriod) return m.isFuturePredicted ? 'predictedPeriod' : 'period'
  if (m.isOvulation) return 'ovulation'
  if (m.isFertile) return 'fertile'
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
  plain: { background: 'transparent', border: 'none', color: 'var(--color-text-primary)' },
}
