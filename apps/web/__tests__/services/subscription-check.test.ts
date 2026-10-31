import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { testPrisma } from '../helpers/test-db'
import {
  runDailySubscriptionCheck,
  listSubscriptionCheckRuns,
  getSubscriptionCheckRun,
  setCronEnabled,
} from '@vesta/shared/server/services'

const P = 'test-subchk'
const ids = { gone: `${P}-gone`, stays: `${P}-stays`, boom: `${P}-boom`, legacy: `${P}-legacy` }
const sid = { gone: 'tel:Z29uZS1zdWJz', stays: 'tel:c3RheXM', boom: 'tel:Ym9vbQ' }
const NOW = new Date('2031-07-01T20:00:00Z') // 02:00 on 2 July, Bangladesh time
const LEGACY_PHONE = '+8801955500004'

const answers: Record<string, 'REGISTERED' | 'UNREGISTERED' | Error> = {
  [sid.gone]: 'UNREGISTERED',
  [sid.stays]: 'REGISTERED',
  [sid.boom]: new Error('BDApps timeout'),
}
const clock = () => new Date(NOW.getTime() + 5000)
const getStatus = async (id: string) => {
  const a = answers[id] ?? 'REGISTERED' // other test files' Pro users are left alone
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
  for (const key of ['gone', 'stays', 'boom'] as const) {
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
    const mine = run!.outcomes.filter((o) => o.userId.startsWith(P))
    expect(mine).toHaveLength(2)
    expect(mine.find((o) => o.userId === ids.gone)).toMatchObject({
      outcome: 'MOVED_TO_FREE',
      bdappsStatus: 'UNREGISTERED',
      maskedSubscriberId: sid.gone,
    })
    expect(mine.find((o) => o.userId === ids.boom)).toMatchObject({ outcome: 'ERROR', error: expect.stringContaining('BDApps timeout') })

    expect((await testPrisma.user.findUnique({ where: { id: ids.gone } }))!.subscriptionStatus).toBe('FREE')
    expect((await testPrisma.user.findUnique({ where: { id: ids.stays } }))!.subscriptionStatus).toBe('PRO')
  })

  it('stores last-confirmed time and reported status for subscribers BDApps answered, not for errors', async () => {
    const stays = await testPrisma.subscription.findFirst({ where: { userId: ids.stays } })
    expect(stays).toMatchObject({ lastReportedStatus: 'REGISTERED', lastConfirmedAt: NOW })
    const gone = await testPrisma.subscription.findFirst({ where: { userId: ids.gone } })
    expect(gone).toMatchObject({ lastReportedStatus: 'UNREGISTERED', lastConfirmedAt: NOW })
    const boom = await testPrisma.subscription.findFirst({ where: { userId: ids.boom } })
    expect(boom!.lastConfirmedAt).toBeNull()
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
    expect(legacy!.maskedSubscriberId).not.toContain('8801955500004')
    expect(legacy!.error ?? '').not.toContain('8801955500004')
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

describe('listSubscriptionCheckRuns', () => {
  it('returns the newest runs first, capped at the limit', async () => {
    const runs = await listSubscriptionCheckRuns(2)
    expect(runs).toHaveLength(2)
    expect(runs[0].startedAt.getTime()).toBeGreaterThanOrEqual(runs[1].startedAt.getTime())
  })
})
