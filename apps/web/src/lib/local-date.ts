/**
 * The calendar day on the device clock as YYYY-MM-DD (contrast bdDayKey in auto-prompt, fixed UTC+6).
 * `new Date().toISOString().slice(0, 10)` is the UTC day, which is "yesterday"
 * between 00:00 and 06:00 in Bangladesh (UTC+6). Use this for any date default.
 */
export function deviceDayString(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** A stored date (Date or ISO string) as the device-local YYYY-MM-DD; a bare YYYY-MM-DD passes through. */
export function toDeviceDay(d: Date | string): string {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  return deviceDayString(new Date(d))
}
