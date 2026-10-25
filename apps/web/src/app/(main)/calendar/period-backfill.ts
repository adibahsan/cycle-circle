/** A past day the user can start a period log from: before today and not inside a logged period. */
export function canLogPastPeriod(
  day: string,
  today: string,
  periods: ReadonlyArray<{ startDate: string; endDate: string }>,
): boolean {
  if (day >= today) return false
  return !periods.some((p) => day >= p.startDate && day <= p.endDate)
}
