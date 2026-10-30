/**
 * Bangladesh days (GLOSSARY): calendar days in Asia/Dhaka, UTC+6 with no DST.
 * Setup dates are counted from the *server's* clock (its HTTP Date header), never
 * the test machine's, and there is no fake clock.
 */
import { APP_TZ, URLS } from './slot.ts'

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

/** `YYYY-MM-DD` of `instant` in the app processes' timezone (`TZ`, UTC unless `E2E_APP_TZ`). */
export function serverLocalDayOf(instant: Date, timeZone: string = APP_TZ): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant)
}

/**
 * The `Date` the app stores for a date-only value (period start/end, symptom date,
 * `lastPeriodStart`, prediction days): UTC midnight of that calendar day, i.e. what
 * `new Date('YYYY-MM-DD')` gives in the services and the seed. Use this for those columns;
 * `bangladeshDayStart` is the *instant* a Bangladesh day begins (timestamps such as `deletedAt`).
 */
export function storedDay(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`)
}

/** `day` moved by `n` days (negative = earlier). */
export function addBangladeshDays(day: string, n: number): string {
  return bangladeshDayOf(new Date(bangladeshDayStart(day).getTime() + n * DAY_MS))
}

/**
 * Bangladesh-day helper anchored on the server's clock. `today` is the server's Bangladesh
 * day; `daysAgo(35)` is that many days earlier; `dateOf(day)` is the Date to write to a date-only
 * column (UTC midnight, as the app stores it); `startOf(day)` is the instant the day begins in Dhaka.
 */
export interface BangladeshDays {
  now: Date
  today: string
  daysAgo(n: number): string
  daysFromNow(n: number): string
  startOf(day: string): Date
  dateOf(day: string): Date
  /**
   * True while the app server's own calendar day (its `TZ`) is not the Bangladesh day: with
   * `TZ=UTC` that is 00:00-06:00 Bangladesh (18:00-24:00 UTC). Guard `test.fail()`s for bugs
   * that compute "today" from the process clock with this, so they are deterministic at every hour.
   */
  serverDayLags: boolean
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
    dateOf: storedDay,
    serverDayLags: serverLocalDayOf(now) !== today,
  }
}
