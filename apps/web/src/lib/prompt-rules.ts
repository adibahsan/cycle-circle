/** Pure rules for the dashboard-only prompts (completion row, logging nudge). */

export const NUDGE_STALE_DAYS = 3

export interface CompletionLike {
  complete: boolean
}

/** The dashboard completion row shows while the profile is below 100%. */
export function showCompletionRow(status: CompletionLike | null | undefined): boolean {
  return !!status && !status.complete
}

/** Whole local days between the most recent log and `today`; null when nothing was ever logged. */
export function daysSinceLastLog(dates: Date[], today: Date = new Date()): number | null {
  if (dates.length === 0) return null
  const latest = dates.reduce((a, b) => (a > b ? a : b))
  const a = new Date(today)
  a.setHours(0, 0, 0, 0)
  const b = new Date(latest)
  b.setHours(0, 0, 0, 0)
  return Math.round((a.getTime() - b.getTime()) / 86_400_000)
}

export function loggingNudgeVariant(input: {
  hasAnyLogs: boolean
  daysSinceLastLog: number | null
}): 'empty' | 'stale' | null {
  if (!input.hasAnyLogs) return 'empty'
  if (input.daysSinceLastLog != null && input.daysSinceLastLog >= NUDGE_STALE_DAYS) return 'stale'
  return null
}
