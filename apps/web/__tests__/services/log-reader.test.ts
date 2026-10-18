import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { queryLogs, maskOtps, appOtpSmsText } from '@vesta/shared/server/services'

let dir: string

function put(channel: string, day: string, recs: object[], gz = false) {
  const d = path.join(dir, channel)
  fs.mkdirSync(d, { recursive: true })
  const body = recs.map((r) => JSON.stringify(r)).join('\n') + '\n'
  if (gz) fs.writeFileSync(path.join(d, `${day}.log.gz`), zlib.gzipSync(body))
  else fs.writeFileSync(path.join(d, `${day}.log`), body)
}
const rec = (channel: string, day: string, time: string, extra: object = {}) => ({
  ts: `${day}T${time}.000+06:00`,
  level: 'info',
  channel,
  event: `${channel}/event`,
  ...extra,
})

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vesta-logread-'))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('queryLogs', () => {
  it('returns an empty result for a missing log directory', async () => {
    expect(await queryLogs({ logDir: path.join(dir, 'nope') })).toEqual({ lines: [], nextCursor: null })
  })

  it('reads plain and gzipped day files, newest first across channels', async () => {
    put('customer', '2026-10-17', [rec('customer', '2026-10-17', '09:00:00')], true)
    put('customer', '2026-10-18', [rec('customer', '2026-10-18', '08:00:00')])
    put('webhook', '2026-10-18', [rec('webhook', '2026-10-18', '10:00:00')])
    const { lines } = await queryLogs({ logDir: dir })
    expect(lines.map((l) => [l.channel, l.ts.slice(0, 19)])).toEqual([
      ['webhook', '2026-10-18T10:00:00'],
      ['customer', '2026-10-18T08:00:00'],
      ['customer', '2026-10-17T09:00:00'],
    ])
  })

  it('does not duplicate a day that exists both plain and gzipped', async () => {
    put('cron', '2026-10-17', [rec('cron', '2026-10-17', '01:00:00')])
    put('cron', '2026-10-17', [rec('cron', '2026-10-17', '01:00:00')], true)
    expect((await queryLogs({ logDir: dir })).lines).toHaveLength(1)
  })

  it('filters by channel, date range, text, requestId and userId', async () => {
    put('translog', '2026-10-17', [
      rec('translog', '2026-10-17', '09:00:00', { userId: 'u1', requestId: 'r1', data: { to: 'PRO' } }),
      rec('translog', '2026-10-17', '10:00:00', { data: { targetUserId: 'u2', reason: 'Refund' } }),
    ])
    put('translog', '2026-10-19', [rec('translog', '2026-10-19', '09:00:00', { userId: 'u1' })])
    put('cron', '2026-10-17', [rec('cron', '2026-10-17', '09:00:00')])

    expect((await queryLogs({ logDir: dir, channels: ['cron'] })).lines).toHaveLength(1)
    expect((await queryLogs({ logDir: dir, from: '2026-10-18' })).lines).toHaveLength(1)
    expect((await queryLogs({ logDir: dir, to: '2026-10-17', channels: ['translog'] })).lines).toHaveLength(2)
    expect((await queryLogs({ logDir: dir, text: 'refund' })).lines).toHaveLength(1)
    expect((await queryLogs({ logDir: dir, requestId: 'r1' })).lines).toHaveLength(1)
    expect((await queryLogs({ logDir: dir, userId: 'u1' })).lines).toHaveLength(2)
    expect((await queryLogs({ logDir: dir, userId: 'u2' })).lines).toHaveLength(1)
  })

  it('pages with a cursor, bounded by limit, across and within days', async () => {
    put('customer', '2026-10-18', [1, 2, 3].map((n) => rec('customer', '2026-10-18', `0${n}:00:00`)))
    put('customer', '2026-10-17', [1, 2].map((n) => rec('customer', '2026-10-17', `0${n}:00:00`)), true)
    const seen: string[] = []
    let cursor: string | null = null
    let pages = 0
    do {
      const r = await queryLogs({ logDir: dir, limit: 2, cursor })
      expect(r.lines.length).toBeLessThanOrEqual(2)
      seen.push(...r.lines.map((l) => l.ts))
      cursor = r.nextCursor
      pages++
    } while (cursor)
    expect(pages).toBe(3)
    expect(seen).toEqual([...seen].sort().reverse())
    expect(new Set(seen).size).toBe(5)
  })

  it('skips malformed lines and ignores unknown files', async () => {
    fs.mkdirSync(path.join(dir, 'error'), { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'error', '2026-10-18.log'),
      'not json\n' + JSON.stringify(rec('error', '2026-10-18', '01:00:00')) + '\n{"x":1}\n',
    )
    fs.writeFileSync(path.join(dir, 'error', 'notes.txt'), 'hi')
    expect((await queryLogs({ logDir: dir })).lines).toHaveLength(1)
  })

  it('masks OTP values in returned lines and raw payloads, and cannot be searched by them', async () => {
    put('merchant', '2026-10-18', [
      rec('merchant', '2026-10-18', '01:00:00', {
        data: { request: { Otp: '482913', subscriberId: 'tel:abc' }, message: 'Your OTP is 771204' },
      }),
    ])
    const { lines } = await queryLogs({ logDir: dir })
    expect(lines[0].raw).not.toContain('482913')
    expect(lines[0].raw).not.toContain('771204')
    expect(lines[0].raw).toContain('tel:abc')
    expect((lines[0].data as { request: { Otp: string } }).request.Otp).toBe('<MASKED>')
    expect((await queryLogs({ logDir: dir, text: '482913' })).lines).toHaveLength(0)
  })
})

describe('maskOtps', () => {
  it('masks otp-named fields and digit-only code, leaves other values', () => {
    expect(maskOtps({ otp: 123456, code: '4821', statusCode: 'S1000', code2: 'x', n: { passcode: '9999' } })).toEqual({
      otp: '<MASKED>',
      code: '<MASKED>',
      statusCode: 'S1000',
      code2: 'x',
      n: { passcode: '<MASKED>' },
    })
  })
})

describe('maskOtps on the real App OTP SMS', () => {
  it.each(['en', 'bn'] as const)('masks the code in the %s template as logged by the merchant channel', (lang) => {
    const text = appOtpSmsText('482913', lang)
    expect(text).toContain('482913') // sanity: the builder really embeds the code
    const masked = maskOtps({ request: { message: text, destinationAddresses: ['tel:x'] } }) as {
      request: { message: string }
    }
    expect(masked.request.message).not.toContain('482913')
    expect(masked.request.message).toContain('<MASKED>')
  })
})
