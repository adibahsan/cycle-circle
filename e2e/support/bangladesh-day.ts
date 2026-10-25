/**
 * Bangladesh days (GLOSSARY): calendar days in Asia/Dhaka, UTC+6 with no DST.
 * Setup dates are counted from the *server's* clock (its HTTP Date header), never
 * the test machine's, and there is no fake clock.
 */
import { URLS } from './slot.ts'

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** The server's current time, from the Date header of a request to the web app. */
export async function serverNow(baseUrl: string = URLS.web): Promise<Date> {
  const res = await fetch(new URL('/api/health/db', baseUrl), { method: 'GET' })
  const date = res.headers.get('date')
  if (!date) throw new Error('server sent no Date header')
  return new Date(date)
}

/** `YYYY-MM-DD` of the Bangladesh day containing `instant`. */
export function bangladeshDayOf(instant: Date): string {
  return new Date(instant.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10)
}

/** The instant a Bangladesh day (`YYYY-MM-DD`) starts. */
export function bangladeshDayStart(day: string): Date {
  return new Date(`${day}T00:00:00.000+06:00`)
}

/** `day` moved by `n` days (negative = earlier). */
export function addBangladeshDays(day: string, n: number): string {
  return bangladeshDayOf(new Date(bangladeshDayStart(day).getTime() + n * DAY_MS))
}

/**
 * Bangladesh-day helper anchored on the server's clock. `today` is the server's Bangladesh
 * day; `daysAgo(35)` is that many days earlier; `startOf(day)` is the Date to write to the DB.
 */
export interface BangladeshDays {
  now: Date
  today: string
  daysAgo(n: number): string
  daysFromNow(n: number): string
  startOf(day: string): Date
}

export async function bangladeshDays(baseUrl: string = URLS.web): Promise<BangladeshDays> {
  const now = await serverNow(baseUrl)
  const today = bangladeshDayOf(now)
  return {
    now,
    today,
    daysAgo: (n) => addBangladeshDays(today, -n),
    daysFromNow: (n) => addBangladeshDays(today, n),
    startOf: bangladeshDayStart,
  }
}
