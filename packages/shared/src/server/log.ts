import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Server logging (ADR 0004). Every line belongs to one log channel (GLOSSARY.md) and is
 * appended, asynchronously, as one JSON object to `<LOG_DIR>/<channel>/<YYYY-MM-DD>.log`,
 * where the date is Asia/Dhaka (a new file starts at Bangladesh midnight). Lines are also
 * mirrored to stdout unless LOG_STDOUT=false. Error-level lines also go to `error/`.
 * Logging never throws: a failed write falls back to stderr.
 */

export type LogChannel = 'merchant' | 'customer' | 'webhook' | 'translog' | 'cron' | 'error'
export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  event: string
  data?: unknown
  level?: LogLevel
  userId?: string | null
  durationMs?: number
}

// ─── Dates ────────────────────────────────────────────────────────────────────

/** Bangladesh has no DST: Dhaka time is always UTC+6. */
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000

function shifted(d: Date): string {
  return new Date(d.getTime() + DHAKA_OFFSET_MS).toISOString()
}

/** `YYYY-MM-DD` in Asia/Dhaka: the log file name. */
export function dhakaDate(d: Date): string {
  return shifted(d).slice(0, 10)
}

/** ISO timestamp in Asia/Dhaka, e.g. `2026-10-18T03:42:37.123+06:00`. */
export function dhakaTimestamp(d: Date): string {
  return shifted(d).replace('Z', '+06:00')
}

// ─── Redaction: credentials only ─────────────────────────────────────────────

const SECRET_KEY = /^(password|token|accesstoken|refreshtoken|jwt|cookie|set-cookie|authorization)$/i

/** Replace credential fields (BDApps password, JWTs, cookies, Authorization) at any depth. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || typeof value !== 'object') return value
  if (value instanceof Error) return serializeError(value)
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1))
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [
      k,
      SECRET_KEY.test(k) ? '<REDACTED>' : redact(v, depth + 1),
    ]),
  )
}

function serializeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { message: String(error) }
  const { code, statusCode } = error as Error & { code?: unknown; statusCode?: unknown }
  return { name: error.name, message: error.message, code, statusCode, stack: error.stack }
}

// ─── Request context ─────────────────────────────────────────────────────────

interface RequestContext {
  requestId: string
  userId?: string
}

const context = new AsyncLocalStorage<RequestContext>()

/** Run `fn` with a requestId (and later a userId) stamped on every line it logs. */
export function withRequestContext<T>(fn: () => T, init?: { requestId?: string; userId?: string }): T {
  return context.run({ requestId: init?.requestId ?? randomUUID(), userId: init?.userId }, fn)
}

/** Attach the authenticated user to the current request's lines. */
export function setRequestUser(userId: string): void {
  const store = context.getStore()
  if (store) store.userId = userId
}

// ─── Writer ──────────────────────────────────────────────────────────────────

const streams = new Map<string, fs.WriteStream>()
let warnedFallback = false

function logDir(): string {
  return process.env.LOG_DIR || path.join(process.cwd(), 'logs')
}

function fallback(line: string, reason?: unknown): void {
  if (!warnedFallback) {
    warnedFallback = true
    process.stderr.write(`[log] file logging failed, using stderr: ${String(reason ?? 'unknown')}\n`)
  }
  process.stderr.write(line)
}

function streamFor(channel: LogChannel, date: string): fs.WriteStream | null {
  const dir = path.join(logDir(), channel)
  const key = path.join(dir, date)
  const open = streams.get(key)
  if (open) return open

  // A new Dhaka date (or LOG_DIR) for this channel: close the previous file.
  for (const [k, s] of streams) {
    if (k.startsWith(dir + path.sep)) {
      s.end()
      streams.delete(k)
    }
  }
  try {
    fs.mkdirSync(dir, { recursive: true })
  } catch {
    return null
  }
  const stream = fs.createWriteStream(path.join(dir, `${date}.log`), { flags: 'a' })
  stream.on('error', (err) => {
    streams.delete(key)
    fallback('', err)
  })
  streams.set(key, stream)
  return stream
}

function write(channel: LogChannel, line: string, date: string): void {
  const stream = streamFor(channel, date)
  if (!stream || stream.destroyed || !stream.writable) return fallback(line, 'cannot open log file')
  stream.write(line, (err) => {
    if (err) fallback(line, err)
  })
}

/** Append one line to `channel` (and to `error` when level is error). Never throws. */
export function log(channel: LogChannel, entry: LogEntry): void {
  try {
    const now = new Date()
    const ctx = context.getStore()
    const record = {
      ts: dhakaTimestamp(now),
      level: entry.level ?? 'info',
      channel,
      event: entry.event,
      requestId: ctx?.requestId,
      userId: entry.userId ?? ctx?.userId,
      durationMs: entry.durationMs,
      data: redact(entry.data),
    }
    const line = JSON.stringify(record) + '\n'
    const date = dhakaDate(now)
    write(channel, line, date)
    if (record.level === 'error' && channel !== 'error') write('error', line, date)
    if (process.env.LOG_STDOUT !== 'false') {
      ;(record.level === 'info' ? process.stdout : process.stderr).write(line)
    }
  } catch (err) {
    try {
      fallback(`${entry.event}\n`, err)
    } catch {
      // logging must never break a request
    }
  }
}

type Extra = Omit<LogEntry, 'event' | 'data'>
const channelLogger = (channel: Exclude<LogChannel, 'error'>) =>
  (event: string, data?: unknown, extra?: Extra) => log(channel, { event, data, ...extra })

/** One function per log channel (GLOSSARY.md: Operations logs). */
export const logger = {
  merchant: channelLogger('merchant'),
  customer: channelLogger('customer'),
  webhook: channelLogger('webhook'),
  translog: channelLogger('translog'),
  cron: channelLogger('cron'),
  /** Errors not tied to another channel. `error` may be anything thrown. */
  error: (event: string, error: unknown, data?: Record<string, unknown>) =>
    log('error', { event, level: 'error', data: { ...data, error: serializeError(error) } }),
}

/** Flush and close every open log file (tests, and on shutdown). */
export async function flushLogs(): Promise<void> {
  const open = [...streams.values()]
  streams.clear()
  await Promise.all(
    open.map((s) => new Promise<void>((resolve) => (s.destroyed ? resolve() : s.end(resolve)))),
  )
}

// A deploy stops the container with SIGTERM: flush buffered lines first (max 2 s).
const g = globalThis as typeof globalThis & { __vestaLogFlushHook?: boolean }
if (!g.__vestaLogFlushHook && typeof process !== 'undefined' && typeof process.once === 'function') {
  g.__vestaLogFlushHook = true
  const flush = () => Promise.race([flushLogs(), new Promise((r) => setTimeout(r, 2000))])
  process.once('SIGTERM', () => {
    // Our listener replaces Node's default exit-on-SIGTERM; if nobody else (e.g. the
    // Next server) handles shutdown, exit ourselves once the logs are flushed.
    void flush().then(() => {
      if (process.listenerCount('SIGTERM') === 0) process.exit(143)
    })
  })
  process.once('beforeExit', () => void flush())
}
