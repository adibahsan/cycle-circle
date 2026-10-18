/** Days after deletion during which an account can still be restored (ADR 0006). */
export const RESTORE_WINDOW_DAYS = 30

/** True while a deleted account can still be restored (inclusive of the 30-day mark). */
export function isWithinRestoreWindow(deletedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - deletedAt.getTime() <= RESTORE_WINDOW_DAYS * 24 * 60 * 60 * 1000
}
