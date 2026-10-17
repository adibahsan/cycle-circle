import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  log,
  logger,
  flushLogs,
  dhakaDate,
  dhakaTimestamp,
  redact,
  withRequestContext,
  setRequestUser,
} from '@vesta/shared/server/log'

let dir: string

function readLines(channel: string, date = dhakaDate(new Date())) {
  const file = path.join(dir, channel, `${date}.log`)
  if (!fs.existsSync(file)) return []
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vesta-log-'))
  vi.stubEnv('LOG_DIR', dir)
  vi.stubEnv('LOG_STDOUT', 'false')
})
afterEach(async () => {
  await flushLogs()
  vi.unstubAllEnvs()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('Asia/Dhaka dates (ADR 0004)', () => {
  it('rolls the file date over at Bangladesh midnight, not UTC midnight', () => {
    expect(dhakaDate(new Date('2026-10-17T17:59:59Z'))).toBe('2026-10-17')
    expect(dhakaDate(new Date('2026-10-17T18:00:00Z'))).toBe('2026-10-18')
  })
  it('stamps lines in Dhaka time with a +06:00 offset', () => {
    expect(dhakaTimestamp(new Date('2026-10-17T21:42:37.123Z'))).toBe('2026-10-18T03:42:37.123+06:00')
  })
})

describe('writing', () => {
  it('appends one JSON line per call to <LOG_DIR>/<channel>/<dhaka-date>.log', async () => {
    logger.merchant('subscription/otp/verify', { subscriberId: 'tel:abc', subscriptionStatus: 'REGISTERED' })
    logger.merchant('subscription/getStatus', { statusCode: 'S1000' })
    await flushLogs()
    const lines = readLines('merchant')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({
      level: 'info',
      channel: 'merchant',
      event: 'subscription/otp/verify',
      data: { subscriberId: 'tel:abc', subscriptionStatus: 'REGISTERED' },
    })
    expect(lines[0].ts).toMatch(/\+06:00$/)
  })

  it('writes error-level lines to their own channel and to error', async () => {
    logger.cron('caas-check.item-failed', { userId: 'u1' }, { level: 'error' })
    logger.error('unhandled', new Error('boom'))
    await flushLogs()
    expect(readLines('cron')).toHaveLength(1)
    const errors = readLines('error')
    expect(errors.map((l) => l.event)).toEqual(['caas-check.item-failed', 'unhandled'])
    expect(errors[1].data.error).toMatchObject({ name: 'Error', message: 'boom' })
    expect(errors[1].data.error.stack).toContain('boom')
  })

  it('never throws when the directory cannot be written; falls back to stderr', async () => {
    const blocker = path.join(dir, 'blocked')
    fs.writeFileSync(blocker, 'a file where a directory should be')
    vi.stubEnv('LOG_DIR', blocker)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    expect(() => log('customer', { event: 'auth.otp.request', data: { phone: '+8801805718862' } })).not.toThrow()
    await flushLogs()
    expect(stderr.mock.calls.map((c) => String(c[0])).join('')).toContain('auth.otp.request')
    stderr.mockRestore()
  })
})

describe('redaction: credentials only (phones, masked ids and OTPs stay)', () => {
  it('redacts password, tokens, cookies and authorization at any depth', () => {
    const out = redact({
      applicationId: 'APP_140389',
      password: 'secret',
      otp: '123456',
      subscriberId: 'tel:8801805718862',
      headers: { Authorization: 'Bearer x', cookie: 'vesta_auth=y' },
      nested: [{ token: 'jwt', accessToken: 'a' }],
    }) as Record<string, unknown>
    expect(out).toMatchObject({
      applicationId: 'APP_140389',
      password: '<REDACTED>',
      otp: '123456',
      subscriberId: 'tel:8801805718862',
      headers: { Authorization: '<REDACTED>', cookie: '<REDACTED>' },
      nested: [{ token: '<REDACTED>', accessToken: '<REDACTED>' }],
    })
  })

  it('is applied to every written line', async () => {
    logger.merchant('subscription/send', { request: { password: 'secret', action: '0' } })
    await flushLogs()
    expect(readLines('merchant')[0].data.request).toEqual({ password: '<REDACTED>', action: '0' })
  })
})

describe('request context', () => {
  it('stamps requestId and userId on every line inside a request', async () => {
    await withRequestContext(async () => {
      setRequestUser('user-1')
      logger.customer('auth.otp.verify', { ok: true })
      logger.translog('plan.change', { from: 'FREE', to: 'PRO', cause: 'otp-verify' })
    }, { requestId: 'req-1' })
    await flushLogs()
    expect(readLines('customer')[0]).toMatchObject({ requestId: 'req-1', userId: 'user-1' })
    expect(readLines('translog')[0]).toMatchObject({ requestId: 'req-1', userId: 'user-1' })
  })

  it('generates a requestId when none is given', async () => {
    await withRequestContext(async () => logger.webhook('subscription.notify', {}))
    await flushLogs()
    expect(readLines('webhook')[0].requestId).toMatch(/\S{8,}/)
  })
})
