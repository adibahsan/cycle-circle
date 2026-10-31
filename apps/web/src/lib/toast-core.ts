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

export interface ToastContent {
  title?: string
  message: string
  celebrate: boolean
}

export interface ToastScheduler {
  /** Plain message now; waits behind a pending or visible celebration instead of cancelling it. */
  show: (content: Omit<ToastContent, 'celebrate'>) => void
  /** Celebration after the source pop-up has closed; replaces whatever plain toast is showing. */
  celebrate: (content: Omit<ToastContent, 'celebrate'>) => void
  /** Close the current toast and move on to the next queued one. */
  dismiss: () => void
  dispose: () => void
}

/**
 * Sequencing for the toast region. Saving usually fires a plain toast of its own (profile
 * completion progress) while the celebration is still waiting out the pop-up's exit; the plain
 * one must queue behind it, not cancel or overwrite it (#157).
 */
export function createToastScheduler(onChange: (item: ToastContent | null) => void): ToastScheduler {
  let showTimer: ReturnType<typeof setTimeout> | null = null
  let hideTimer: ReturnType<typeof setTimeout> | null = null
  let celebrating = false
  const queue: ToastContent[] = []

  const display = (item: ToastContent) => {
    if (hideTimer) clearTimeout(hideTimer)
    celebrating = item.celebrate
    onChange(item)
    hideTimer = setTimeout(dismiss, TOAST_VISIBLE_MS)
  }

  function dismiss() {
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = null
    celebrating = false
    const next = queue.shift()
    if (next) display(next)
    else onChange(null)
  }

  return {
    show: (content) => {
      const item = { ...content, celebrate: false }
      if (celebrating || showTimer) queue.push(item)
      else display(item)
    },
    celebrate: (content) => {
      if (showTimer) clearTimeout(showTimer)
      showTimer = setTimeout(() => {
        showTimer = null
        display({ ...content, celebrate: true })
      }, TOAST_AFTER_POPUP_MS)
    },
    dismiss,
    dispose: () => {
      if (showTimer) clearTimeout(showTimer)
      if (hideTimer) clearTimeout(hideTimer)
      showTimer = null
      hideTimer = null
    },
  }
}
