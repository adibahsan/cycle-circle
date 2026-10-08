/**
 * Toast logic (pure). The React side lives in `@/components/ui/Toast`.
 */

/** Let the source pop-up's exit animation (200ms) finish before the toast appears. */
export const TOAST_AFTER_POPUP_MS = 260
export const TOAST_VISIBLE_MS = 5000

export type CelebrationKind = 'period' | 'symptom' | 'streak' | 'milestone'

export interface CelebrationCopy {
  titleKey: string
  bodyKey: string
  values: { count: number }
}

export function celebrationCopy(kind: CelebrationKind, count = 0): CelebrationCopy {
  return {
    titleKey: `celebration.${kind}Title`,
    bodyKey: `celebration.${kind}Body`,
    values: { count },
  }
}

/** Confetti is decorative motion: never under reduced motion. */
export function shouldShowConfetti(reducedMotion: boolean): boolean {
  return !reducedMotion
}
