/**
 * Read an app's translog (plan changes), which has no screen. Each app appends JSON
 * lines to `<LOG_DIR>/translog/<Dhaka date>.log`; see packages/shared/src/server/log.ts.
 * Admin mutations (grant/revoke/suspend) write under `admin/`; OTP signup and webhooks
 * write under `web/`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { LOG_ROOT } from './slot.ts'

export interface TranslogLine {
  event: string
  userId?: string
  data: Record<string, unknown>
}

export type TranslogApp = 'web' | 'admin'

function dhakaDate(d = new Date()): string {
  return new Date(d.getTime() + 6 * 3600_000).toISOString().slice(0, 10)
}

function readAppTranslog(app: TranslogApp, userId: string): TranslogLine[] {
  const file = path.join(LOG_ROOT, app, 'translog', `${dhakaDate()}.log`)
  if (!fs.existsSync(file)) return []
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((l) => {
      try {
        return [JSON.parse(l) as TranslogLine]
      } catch {
        return []
      }
    })
    .filter((l) => l.userId === userId)
}

/**
 * Translog lines for one user, oldest first (today's file; the log is written asynchronously).
 * Defaults to the web app (OTP / webhooks). Pass `app: 'admin'` for admin grant/revoke/suspend
 * lines, or `apps: ['web','admin']` to merge both.
 * Lines that are not valid JSON are skipped: another worker's app may be mid-append.
 * Edge: the file is named for the Dhaka date, so a run that crosses Dhaka midnight (18:00 UTC)
 * reads only the new day's file; poll for a line written before midnight and it may be missed.
 */
export function translogFor(
  userId: string,
  opts: { app?: TranslogApp; apps?: TranslogApp[] } = {},
): TranslogLine[] {
  const apps = opts.apps ?? (opts.app ? [opts.app] : ['web'])
  return apps.flatMap((app) => readAppTranslog(app, userId))
}
