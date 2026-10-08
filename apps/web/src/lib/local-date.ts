/**
 * The user's local calendar day as YYYY-MM-DD, from the device clock.
 * `new Date().toISOString().slice(0, 10)` is the UTC day, which is "yesterday"
 * between 00:00 and 06:00 in Bangladesh (UTC+6). Use this for any date default.
 */
export function localDayString(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
