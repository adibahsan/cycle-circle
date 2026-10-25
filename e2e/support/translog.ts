/**
 * Read the web app's translog (plan changes), which has no screen. The app appends JSON
 * lines to `<LOG_DIR>/translog/<Dhaka date>.log`; see packages/shared/src/server/log.ts.
 */
import fs from 'node:fs'
import path from 'node:path'
import { LOG_ROOT } from './slot.ts'

export interface TranslogLine {
  event: string
  userId?: string
  data: Record<string, unknown>
}

function dhakaDate(d = new Date()): string {
  return new Date(d.getTime() + 6 * 3600_000).toISOString().slice(0, 10)
}

/** Translog lines for one user, oldest first (today's file; the log is written asynchronously). */
export function translogFor(userId: string): TranslogLine[] {
  const file = path.join(LOG_ROOT, 'web', 'translog', `${dhakaDate()}.log`)
  if (!fs.existsSync(file)) return []
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as TranslogLine)
    .filter((l) => l.userId === userId)
}
