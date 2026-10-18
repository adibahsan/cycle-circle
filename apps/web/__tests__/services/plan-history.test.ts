import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getPlanHistory } from '@vesta/shared/server/services'

let dir: string
function put(day: string, recs: object[]) {
  fs.mkdirSync(path.join(dir, 'translog'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'translog', `${day}.log`), recs.map((r) => JSON.stringify(r)).join('\n') + '\n')
}
const rec = (time: string, event: string, userId: string, data: object) => ({
  ts: `2026-10-18T${time}.000+06:00`,
  level: 'info',
  channel: 'translog',
  event,
  userId,
  data,
})

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vesta-planhist-'))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('getPlanHistory', () => {
  it('is empty when the user has no plan lines', async () => {
    expect(await getPlanHistory('u1', { logDir: dir })).toEqual([])
  })

  it('returns only this user plan events, newest first, with who and why', async () => {
    put('2026-10-18', [
      rec('08:00:00', 'plan.change', 'u1', { from: 'FREE', to: 'PRO', cause: 'webhook', changed: true }),
      rec('09:00:00', 'plan.change', 'u1', { from: 'PRO', to: 'LAPSED', cause: 'admin', adminId: 'a1', changed: true }),
      rec('09:30:00', 'plan.change', 'u2', { from: 'FREE', to: 'PRO', cause: 'webhook', changed: true }),
      rec('10:00:00', 'plan.override-kept', 'u1', { status: 'LAPSED', cause: 'webhook' }),
      rec('11:00:00', 'other.event', 'u1', {}),
    ])
    const h = await getPlanHistory('u1', { logDir: dir })
    expect(h.map((e) => [e.event, e.from, e.to, e.cause, e.adminId, e.changed])).toEqual([
      ['plan.override-kept', 'LAPSED', 'LAPSED', 'webhook', undefined, false],
      ['plan.change', 'PRO', 'LAPSED', 'admin', 'a1', true],
      ['plan.change', 'FREE', 'PRO', 'webhook', undefined, true],
    ])
  })

  it('includes BDApps unsubscribe outcomes (unsubscribed / failed / skipped)', async () => {
    put('2026-10-18', [
      rec('08:00:00', 'plan.bdapps-unsubscribe', 'u1', { result: 'unsubscribed', subscriberId: 'tel:x', adminId: 'a1' }),
      rec('09:00:00', 'plan.bdapps-unsubscribe', 'u1', { result: 'failed', adminId: 'a1', error: 'E1351 boom' }),
      rec('10:00:00', 'plan.bdapps-unsubscribe', 'u1', { result: 'skipped', adminId: 'a2' }),
      rec('10:30:00', 'plan.bdapps-unsubscribe', 'u2', { result: 'skipped', adminId: 'a2' }),
    ])
    const h = await getPlanHistory('u1', { logDir: dir })
    expect(h.map((e) => [e.event, e.unsubscribe?.result, e.adminId, e.unsubscribe?.error, e.changed])).toEqual([
      ['plan.bdapps-unsubscribe', 'skipped', 'a2', undefined, false],
      ['plan.bdapps-unsubscribe', 'failed', 'a1', 'E1351 boom', false],
      ['plan.bdapps-unsubscribe', 'unsubscribed', 'a1', undefined, false],
    ])
  })
})
