import fs from 'node:fs/promises'
import path from 'node:path'
import zlib from 'node:zlib'
import type { LogChannel, LogLevel } from '../log'

/**
 * Read-only reader over the dated per-channel log files written by `server/log.ts`
 * (ADR 0004): `<LOG_DIR>/<channel>/YYYY-MM-DD.log` for today, `.log.gz` for past days.
 * Results are newest first. One-time passwords are masked at read time.
 */

export const LOG_CHANNELS: readonly LogChannel[] = [
  'merchant',
  'customer',
  'webhook',
  'translog',
  'cron',
  'error',
]

export interface LogLine {
  ts: string
  level: LogLevel
  channel: LogChannel
  event: string
  requestId?: string
  userId?: string
  durationMs?: number
  data: unknown
  /** The full line as JSON text (OTPs masked): the "raw payload". */
  raw: string
}

export interface LogQuery {
  /** Default: every channel. */
  channels?: LogChannel[]
  /** Inclusive Asia/Dhaka dates, `YYYY-MM-DD`. */
  from?: string
  to?: string
  /** Case-insensitive substring of the (masked) line. */
  text?: string
  requestId?: string
  /** Matches the line's `userId`, or `data.userId` / `data.targetUserId`. */
  userId?: string
  /** Default 100, max 500. */
  limit?: number
  /** `nextCursor` of the previous page. */
  cursor?: string | null
  /** Override `LOG_DIR` (tests). */
  logDir?: string
}

export interface LogQueryResult {
  lines: LogLine[]
  nextCursor: string | null
}

export const MASKED_OTP = '<MASKED>'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const FILE_RE = /^(\d{4}-\d{2}-\d{2})\.log(\.gz)?$/
const OTP_KEY = /otp|passcode|verification_?code|^pin$/i
const OTP_IN_TEXT = /(otp[^\d\n]{0,20})(\d{4,8})/gi

/** Mask one-time passwords at any depth: OTP-named fields, digit-only `code`, and "otp: 123456" in text. */
export function maskOtps(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return value.replace(OTP_IN_TEXT, `$1${MASKED_OTP}`)
  if (depth > 10 || value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((v) => maskOtps(v, depth + 1))
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => {
      const scalar = typeof v === 'string' || typeof v === 'number'
      if (scalar && (OTP_KEY.test(k) || (k === 'code' && /^\d{4,8}$/.test(String(v))))) {
        return [k, MASKED_OTP]
      }
      return [k, maskOtps(v, depth + 1)]
    }),
  )
}

function resolveDir(override?: string): string {
  return override ?? (process.env.LOG_DIR || path.join(process.cwd(), 'logs'))
}

/** Day -> file path for one channel; the plain file wins over the gz while a day is being compressed. */
async function dayFiles(dir: string, channel: LogChannel): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  let names: string[]
  try {
    names = await fs.readdir(path.join(dir, channel))
  } catch {
    return out
  }
  for (const name of names.sort()) {
    const m = FILE_RE.exec(name)
    if (!m) continue
    if (m[2] && out.has(m[1])) continue
    out.set(m[1], path.join(dir, channel, name))
  }
  return out
}

async function readFileText(file: string): Promise<string> {
  try {
    const buf = await fs.readFile(file)
    return (file.endsWith('.gz') ? zlib.gunzipSync(buf) : buf).toString('utf8')
  } catch {
    return '' // unreadable or half-written gz: skip, never fail the page
  }
}

function parseLine(text: string, channel: LogChannel): LogLine | null {
  let rec: Record<string, unknown>
  try {
    rec = JSON.parse(text)
  } catch {
    return null
  }
  if (!rec || typeof rec !== 'object' || typeof rec.ts !== 'string') return null
  const masked = maskOtps(rec) as Record<string, unknown>
  return {
    ts: masked.ts as string,
    level: (masked.level as LogLevel) ?? 'info',
    channel: (masked.channel as LogChannel) ?? channel,
    event: String(masked.event ?? ''),
    requestId: masked.requestId as string | undefined,
    userId: masked.userId as string | undefined,
    durationMs: masked.durationMs as number | undefined,
    data: masked.data,
    raw: JSON.stringify(masked),
  }
}

function matchesUser(line: LogLine, userId: string): boolean {
  if (line.userId === userId) return true
  const d = line.data
  if (d && typeof d === 'object') {
    const rec = d as Record<string, unknown>
    return rec.userId === userId || rec.targetUserId === userId
  }
  return false
}

/** Matching lines of one Dhaka day across `channels`, newest first. */
async function readDay(
  dir: string,
  day: string,
  files: [LogChannel, string][],
  q: LogQuery,
): Promise<LogLine[]> {
  const text = q.text?.toLowerCase()
  const lines: { line: LogLine; order: number }[] = []
  let order = 0
  for (const [channel, file] of files) {
    for (const raw of (await readFileText(file)).split('\n')) {
      if (!raw) continue
      const line = parseLine(raw, channel)
      if (!line) continue
      order++
      if (q.requestId && line.requestId !== q.requestId) continue
      if (q.userId && !matchesUser(line, q.userId)) continue
      if (text && !line.raw.toLowerCase().includes(text)) continue
      lines.push({ line, order })
    }
  }
  // ts is ISO with a fixed +06:00 offset, so string order is time order.
  lines.sort((a, b) => (a.line.ts === b.line.ts ? b.order - a.order : a.line.ts < b.line.ts ? 1 : -1))
  return lines.map((l) => l.line)
}

function parseCursor(cursor?: string | null): { day: string; skip: number } | null {
  if (!cursor) return null
  const [day, skip] = cursor.split(':')
  if (!DAY_RE.test(day ?? '') || !/^\d+$/.test(skip ?? '')) return null
  return { day, skip: Number(skip) }
}

/**
 * Query the logs, newest first. The cursor is `<day>:<lines already returned from that day>`,
 * so paging walks day by day and only reads the days it needs.
 */
export async function queryLogs(q: LogQuery = {}): Promise<LogQueryResult> {
  const dir = resolveDir(q.logDir)
  const limit = Math.min(Math.max(Math.trunc(q.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 1), MAX_LIMIT)
  const channels = (q.channels?.length ? q.channels : LOG_CHANNELS).filter((c) =>
    LOG_CHANNELS.includes(c),
  )
  const from = q.from && DAY_RE.test(q.from) ? q.from : undefined
  const to = q.to && DAY_RE.test(q.to) ? q.to : undefined
  const cursor = parseCursor(q.cursor)

  const perChannel = await Promise.all(channels.map(async (c) => [c, await dayFiles(dir, c)] as const))
  const days = new Set<string>()
  for (const [, m] of perChannel) for (const d of m.keys()) days.add(d)
  const ordered = [...days]
    .filter((d) => (!from || d >= from) && (!to || d <= to) && (!cursor || d <= cursor.day))
    .sort()
    .reverse()

  const lines: LogLine[] = []
  for (let i = 0; i < ordered.length; i++) {
    const day = ordered[i]
    const files = perChannel.flatMap(([c, m]) => (m.has(day) ? [[c, m.get(day)!] as [LogChannel, string]] : []))
    const skip = cursor && cursor.day === day ? cursor.skip : 0
    const dayLines = await readDay(dir, day, files, q)
    const room = limit - lines.length
    lines.push(...dayLines.slice(skip, skip + room))
    if (skip + room < dayLines.length) return { lines, nextCursor: `${day}:${skip + room}` }
    // Day exhausted exactly at the limit: continue from the next day, if any.
    if (lines.length === limit && i + 1 < ordered.length) {
      return { lines, nextCursor: `${ordered[i + 1]}:0` }
    }
  }
  return { lines, nextCursor: null }
}
