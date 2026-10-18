/** Pill action on a tinted card: a card-white pill link or button (never a link wrapping a button). */
export const PILL_ACTION =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-[var(--color-bg-card)] px-5 text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]'

/**
 * Goal-accent fill, as an inline style because the accent is a per-goal CSS variable.
 * Used by the active nav item and the logging nudge's primary CTA.
 */
export const GOAL_ACCENT_FILL = { color: 'var(--color-on-accent)', backgroundColor: 'var(--goal-accent)' } as const
