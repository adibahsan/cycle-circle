import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { testPrisma } from '../helpers/test-db'
import {
  runDailySubscriptionCheck,
  listSubscriptionCheckRuns,
  getSubscriptionCheckRun,
  setCronEnabled,
  listBdappsSubscribers,
} from '@vesta/shared/server/services'

const P = 'test-subchk'
const ids = { vanish: `${P}-vanish`, gone: `${P}-gone`, stays: `${P}-stays`, boom: `${P}-boom`, blocked: `${P}-blocked`, legacy: `${P}-legacy` }
const sid = { vanish: 'tel:dmFuaXNo', gone: 'tel:Z29uZS1zdWJz', stays: 'tel:c3RheXM', boom: 'tel:Ym9vbQ', blocked: 'tel:YmxvY2tlZA' }
const NOW = new Date('2031-07-01T20:00:00Z') // 02:00 on 2 July, Bangladesh time
const LEGACY_PHONE = '+8801955500009'

const answers: Record<string, string | Error> = {
  [sid.gone]: 'UNREGISTERED',
  [sid.blocked]: 'TEMPORARY BLOCKED',
  [sid.stays]: 'REGISTERED',
  [sid.vanish]: 'REGISTERED',
  [LEGACY_PHONE]: 'REGISTERED',
  [sid.boom]: new Error('BDApps timeout'),
}
const clockAt = (ms: number) => new Date(NOW.getTime() + ms)
const clock = () => new Date(NOW.getTime() + 5000)
const getStatus = async (id: string) => {
  // Other test files' subscribers share this DB: erroring leaves them alone, where answering
  // REGISTERED would end their admin override and UNREGISTERED would move them to Free.
  const a = answers[id] ?? new Error('not a subscriber of this test')
  if (a instanceof Error) throw a
  return a
}

async function cleanup() {
  await testPrisma.subscriptionCheckRun.deleteMany({ where: { startedAt: { gte: new Date('2031-01-01') } } })
  await testPrisma.subscription.deleteMany({ where: { userId: { startsWith: P } } })
  await testPrisma.user.deleteMany({ where: { id: { startsWith: P } } })
  await testPrisma.cronSetting.deleteMany({ where: { slug: 'caas-check' } })
}

beforeAll(async () => {
  await cleanup()
  let n = 0
  for (const key of ['gone', 'stays', 'boom', 'vanish', 'blocked'] as const) {
    await testPrisma.user.create({
      data: { id: ids[key], phone: `+880195550000${++n}`, authMethod: 'OTP', subscriptionStatus: 'PRO' },
    })
    await testPrisma.subscription.create({ data: { userId: ids[key], status: 'PRO', bdappsSubscriberId: sid[key] } })
  }
  // Legacy Pro user with no subscription row: only has a raw phone id.
  await testPrisma.user.create({
    data: { id: ids.legacy, phone: LEGACY_PHONE, authMethod: 'OTP', subscriptionStatus: 'PRO' },
  })
})

afterAll(async () => {
  await cleanup()
  await testPrisma.$disconnect()
})

describe('runDailySubscriptionCheck', () => {
  it('persists a run for a manual trigger, with moved and errored subscribers masked', async () => {
    const result = await runDailySubscriptionCheck({ trigger: 'MANUAL', now: NOW, clock, overrideDisabled: true, getStatus })
    expect(result.status).toBe('OK')
    expect(result.checked).toBeGreaterThanOrEqual(3)
    expect(result.movedUserIds).toContain(ids.gone)

    const run = await getSubscriptionCheckRun(result.runId)
    expect(run).toMatchObject({ trigger: 'MANUAL', status: 'OK', movedCount: result.moved, errorCount: result.errors })
    expect(run!.startedAt).toEqual(NOW)
    expect(run!.finishedAt).toEqual(clock())
    const mine = run!.outcomes.filter((o) => o.userId?.startsWith(P))
    expect(mine).toHaveLength(3)
    expect(mine.find((o) => o.userId === ids.gone)).toMatchObject({
      outcome: 'MOVED_TO_FREE',
      bdappsStatus: 'UNREGISTERED',
      maskedSubscriberId: sid.gone,
    })
    expect(mine.find((o) => o.userId === ids.blocked)).toMatchObject({
      outcome: 'MOVED_TO_FREE',
      bdappsStatus: 'TEMPORARY BLOCKED',
      maskedSubscriberId: sid.blocked,
    })
    expect(mine.find((o) => o.userId === ids.boom)).toMatchObject({ outcome: 'ERROR', error: expect.stringContaining('BDApps timeout') })

    expect((await testPrisma.user.findUnique({ where: { id: ids.gone } }))!.subscriptionStatus).toBe('FREE')
    expect((await testPrisma.user.findUnique({ where: { id: ids.stays } }))!.subscriptionStatus).toBe('PRO')
    expect((await testPrisma.user.findUnique({ where: { id: ids.blocked } }))!.subscriptionStatus).toBe('FREE')
  })

  it('stores last-confirmed time and reported status for subscribers BDApps answered, not for errors', async () => {
    const stays = await testPrisma.subscription.findFirst({ where: { userId: ids.stays } })
    expect(stays).toMatchObject({ lastReportedStatus: 'REGISTERED', lastConfirmedAt: NOW })
    const gone = await testPrisma.subscription.findFirst({ where: { userId: ids.gone } })
    expect(gone).toMatchObject({ lastReportedStatus: 'UNREGISTERED', lastConfirmedAt: NOW })
    const boom = await testPrisma.subscription.findFirst({ where: { userId: ids.boom } })
    expect(boom!.lastConfirmedAt).toBeNull()
  })

  it('records last-confirmed for a legacy Pro user with no subscription row, without changing their plan', async () => {
    const row = await testPrisma.subscription.findFirst({ where: { userId: ids.legacy } })
    expect(row).toMatchObject({
      status: 'PRO',
      adminOverride: false,
      amount: null,
      bdappsSubscriberId: LEGACY_PHONE,
      lastReportedStatus: 'REGISTERED',
      lastConfirmedAt: NOW,
    })
    expect((await testPrisma.user.findUnique({ where: { id: ids.legacy } }))!.subscriptionStatus).toBe('PRO')
    expect(await testPrisma.subscription.count({ where: { userId: ids.legacy } })).toBe(1)
    // Still checked on the next run, as a phone id (never downgraded on an ambiguous answer).
    expect((await listBdappsSubscribers()).some((s) => s.userId === ids.legacy)).toBe(true)
  })

  it('never stores a raw phone id', async () => {
    // The legacy phone user errors out so its outcome would be recorded.
    const answersWithLegacy = (id: string) =>
      id === LEGACY_PHONE ? Promise.reject(new Error(`lookup failed for ${LEGACY_PHONE}`)) : getStatus(id)
    const later = new Date(NOW.getTime() + 60_000)
    const result = await runDailySubscriptionCheck({ trigger: 'CRON', now: later, clock, overrideDisabled: true, getStatus: answersWithLegacy })
    const run = await getSubscriptionCheckRun(result.runId)
    const legacy = run!.outcomes.find((o) => o.userId === ids.legacy)
    expect(legacy).toBeDefined()
    expect(legacy!.maskedSubscriberId).not.toContain('8801955500009')
    expect(legacy!.error ?? '').not.toContain('8801955500009')
  })

  it('counts revoked subscribers asked at BDApps as checked, so errors never exceed checked', async () => {
    const revoked = `${P}-revoked`
    const rsid = 'tel:cmV2b2tlZA'
    await testPrisma.user.create({ data: { id: revoked, phone: '+8801955500010', authMethod: 'OTP', subscriptionStatus: 'FREE' } })
    await testPrisma.subscription.create({
      data: { userId: revoked, status: 'FREE', adminOverride: true, adminOverrideAt: NOW, bdappsSubscriberId: rsid },
    })
    try {
      const asked: string[] = []
      const recording = async (id: string) => {
        asked.push(id)
        if (id === rsid) throw new Error('BDApps timeout')
        return getStatus(id)
      }
      const result = await runDailySubscriptionCheck({ trigger: 'MANUAL', now: clockAt(500_000), clock, overrideDisabled: true, getStatus: recording })
      expect(result.checked).toBe(asked.length)
      expect(asked).toContain(rsid)
      expect(result.errors).toBeGreaterThanOrEqual(1)
      expect(result.errors).toBeLessThanOrEqual(result.checked)
      expect(await getSubscriptionCheckRun(result.runId)).toMatchObject({ checkedCount: result.checked })
    } finally {
      await testPrisma.subscription.deleteMany({ where: { userId: revoked } })
      await testPrisma.user.deleteMany({ where: { id: revoked } })
    }
  })

  it('records a cron run as skipped when the job is switched off', async () => {
    await setCronEnabled('caas-check', false, ids.stays)
    const t = new Date(NOW.getTime() + 120_000)
    const result = await runDailySubscriptionCheck({ trigger: 'CRON', now: t, clock, getStatus })
    expect(result).toMatchObject({ status: 'SKIPPED', checked: 0, moved: 0, errors: 0 })
    expect(await getSubscriptionCheckRun(result.runId)).toMatchObject({ trigger: 'CRON', status: 'SKIPPED', checkedCount: 0 })
    await testPrisma.cronSetting.deleteMany({ where: { slug: 'caas-check' } })
  })

  it('a manual run still runs when the job is switched off', async () => {
    await setCronEnabled('caas-check', false, ids.stays)
    const t = new Date(NOW.getTime() + 180_000)
    const result = await runDailySubscriptionCheck({ trigger: 'MANUAL', now: t, clock, overrideDisabled: true, getStatus })
    expect(result.status).toBe('OK')
    await testPrisma.cronSetting.deleteMany({ where: { slug: 'caas-check' } })
  })

  it('records a failed run when the check itself breaks, then rethrows', async () => {
    const t = new Date(NOW.getTime() + 240_000)
    const { prisma } = await import('@vesta/shared')
    const spy = vi.spyOn(prisma.subscription, 'findMany').mockRejectedValueOnce(new Error('db down'))
    await expect(runDailySubscriptionCheck({ trigger: 'CRON', now: t, clock, overrideDisabled: true, getStatus })).rejects.toThrow('db down')
    spy.mockRestore()
    const runs = await listSubscriptionCheckRuns(30)
    expect(runs.find((r) => r.startedAt.getTime() === t.getTime())).toMatchObject({ status: 'FAILED', error: 'db down' })
  })
})

describe('a user deleted mid-run', () => {
  it('does not break the run: it finishes, and the outcome keeps the masked id with no user', async () => {
    const t = clockAt(300_000)
    const deleting = async (id: string) => {
      if (id === sid.vanish) {
        await testPrisma.user.delete({ where: { id: ids.vanish } }) // an admin deletes them mid-run
        return 'UNREGISTERED' as const
      }
      return getStatus(id)
    }
    const result = await runDailySubscriptionCheck({ trigger: 'CRON', now: t, clock, overrideDisabled: true, getStatus: deleting })
    expect(result.status).toBe('OK')
    const run = await getSubscriptionCheckRun(result.runId)
    expect(run!.finishedAt).not.toBeNull()
    expect(run!.errorCount).toBeGreaterThanOrEqual(1)
    const orphan = run!.outcomes.find((o) => o.maskedSubscriberId === sid.vanish)
    expect(orphan).toMatchObject({ userId: null, outcome: 'ERROR' })
  })

  it('deleting a user later is never blocked by run history', async () => {
    const t = clockAt(360_000)
    const result = await runDailySubscriptionCheck({ trigger: 'CRON', now: t, clock, overrideDisabled: true, getStatus })
    await testPrisma.user.delete({ where: { id: ids.boom } })
    const run = await getSubscriptionCheckRun(result.runId)
    const kept = run!.outcomes.find((o) => o.maskedSubscriberId === sid.boom)
    expect(kept).toMatchObject({ userId: null, outcome: 'ERROR' })
  })

  it('still stores every outcome when a user vanishes between the existence check and the write', async () => {
    const t = clockAt(390_000)
    const { prisma } = await import('@vesta/shared')
    const fk = Object.assign(new Error('Foreign key constraint violated'), { code: 'P2003' })
    const spy = vi.spyOn(prisma.subscriptionCheckOutcome, 'createMany').mockRejectedValueOnce(fk)
    const erroring = (id: string) => (id === sid.stays ? Promise.reject(new Error('BDApps timeout')) : getStatus(id))
    const result = await runDailySubscriptionCheck({ trigger: 'CRON', now: t, clock, overrideDisabled: true, getStatus: erroring })
    spy.mockRestore()
    const run = await getSubscriptionCheckRun(result.runId)
    expect(run!.status).toBe('OK')
    expect(run!.outcomes.some((o) => o.maskedSubscriberId === sid.stays && o.userId === ids.stays)).toBe(true)
  })

  it('closes the run as failed when its outcomes cannot be written', async () => {
    const t = clockAt(420_000)
    const { prisma } = await import('@vesta/shared')
    const spy = vi.spyOn(prisma.subscriptionCheckOutcome, 'createMany').mockRejectedValueOnce(new Error('disk full'))
    // `stays` errors so there is an outcome to write.
    const erroring = (id: string) => (id === sid.stays ? Promise.reject(new Error('BDApps timeout')) : getStatus(id))
    await expect(runDailySubscriptionCheck({ trigger: 'CRON', now: t, clock, overrideDisabled: true, getStatus: erroring })).rejects.toThrow('disk full')
    spy.mockRestore()
    const run = (await listSubscriptionCheckRuns(30)).find((r) => r.startedAt.getTime() === t.getTime())
    expect(run).toMatchObject({ status: 'FAILED', error: 'disk full' })
    expect(run!.finishedAt).not.toBeNull()
  })
})

describe('listSubscriptionCheckRuns', () => {
  it('returns the newest runs first, capped at the limit', async () => {
    // This file's runs start in 2031, so they are the newest whatever other files write.
    const runs = await listSubscriptionCheckRuns(2)
    expect(runs).toHaveLength(2)
    expect(runs.every((r) => r.startedAt >= new Date('2031-01-01'))).toBe(true)
    expect(runs[0].startedAt.getTime()).toBeGreaterThanOrEqual(runs[1].startedAt.getTime())
  })
})
