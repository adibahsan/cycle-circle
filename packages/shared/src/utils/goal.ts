export const GOAL_VALUES = ['tracking', 'conceive', 'perimenopause'] as const;
export type GoalValue = (typeof GOAL_VALUES)[number];

/**
 * Tolerant normalizer: maps both canonical ids AND legacy human labels
 * (written by older onboarding code) to a canonical GoalValue.
 */
export function normalizeGoal(goal?: string | null): GoalValue | null {
  if (!goal) return null;
  const g = goal.trim().toLowerCase();
  if (g === 'tracking' || g === 'cycle tracking' || g === 'period tracking') return 'tracking';
  if (g === 'conceive' || g === 'trying to conceive') return 'conceive';
  // Pregnancy mode was removed; legacy values fall back to plain tracking.
  if (g === 'pregnancy' || g === 'pregnant') return 'tracking';
  if (
    g === 'perimenopause' ||
    g === 'perimenopause support' ||
    g === 'menopause'
  )
    return 'perimenopause';
  return null;
}

export const isTTC = (goal?: string | null): boolean => normalizeGoal(goal) === 'conceive';
export const isMenopause = (goal?: string | null): boolean => normalizeGoal(goal) === 'perimenopause';

/**
 * Default notification preferences for a profile's tracking goal. The goal
 * drives which alerts fire by default; the user can still override per-type in
 * settings. Shared by the app (profile create / goal change) and the DB seed so
 * there is a single source of truth.
 *   conceive (TTC) → fertile-window only
 *   perimenopause  → period + logging (no fertile)
 *   tracking/other → all on
 */
export function defaultNotificationPrefsForGoal(goal?: string | null): {
  periodAlert: boolean;
  fertileWindow: boolean;
  loggingReminder: boolean;
} {
  const g = normalizeGoal(goal);
  if (g === 'conceive') return { periodAlert: false, fertileWindow: true, loggingReminder: false };
  if (g === 'perimenopause') return { periodAlert: true, fertileWindow: false, loggingReminder: true };
  return { periodAlert: true, fertileWindow: true, loggingReminder: true };
}

/**
 * Per-goal accent — returns a `--color-goal-*` CSS variable (theme-aware).
 * Used to set a scoped `--goal-accent` custom property. Text on an accent
 * fill uses `--color-on-accent`.
 *   tracking      → --color-goal-tracking      (rose)
 *   conceive      → --color-goal-conceive      (gold ink)
 *   perimenopause → --color-goal-perimenopause (mauve)
 */
export function goalAccentVar(goal?: string | null): string {
  switch (normalizeGoal(goal)) {
    case 'conceive':
      return 'var(--color-goal-conceive)';
    case 'perimenopause':
      return 'var(--color-goal-perimenopause)';
    case 'tracking':
    default:
      return 'var(--color-goal-tracking)';
  }
}
