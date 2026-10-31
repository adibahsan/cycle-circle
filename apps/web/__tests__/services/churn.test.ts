import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { testPrisma } from '../helpers/test-db'

// BDApps is the system boundary: stub unsubscribe, keep the rest of the adapter real.
const bdapps = vi.hoisted(() => ({ setSubscription: vi.fn() }))
vi.mock('@vesta/shared/server/adapters/bdapps', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vesta/shared/server/adapters/bdapps')>()),
  ...bdapps,
}))

const svc = await import('@vesta/shared/server/services')

const P = 'test-churn'
const ADMIN = `${P}-admin`
const u = (n: string) => `${P}-${n}`
const SID = (n: string) => `tel:${Buffer.from(`${P}-${n}`).toString('base64url')}`
const CHECK_NOW = new Date('2032-03-10T20:00:00Z') // 02:00 on 11 March 2032, Bangladesh time

async function seedPro(n: string, phoneSuffix: number) {
  await testPrisma.user.create({
    data: { id: u(n), phone: `+8801960000${String(phoneSuffix).padStart(3, '0')}`, authMethod: 'OTP', subscriptionStatus: 'PRO' },
  })
  await testPrisma.subscription.create({ data: { userId: u(n), status: 'PRO', bdappsSubscriberId: SID(n) } })
}
const events = (n: string) => testPrisma.churnEvent.findMany({ where: { userId: u(n) } })

async function cleanup() {
  await testPrisma.churnEvent.deleteMany({
    where: { OR: [{ userId: { startsWith: P } }, { occurredAt: { gte: new Date('2032-01-01'), lt: new Date('2033-01-01') } }] },
  })
  await testPrisma.proSnapshot.deleteMany({ where: { day: { gte: new Date('2032-01-01'), lt: new Date('2033-01-01') } } })
  await testPrisma.adminAuditLog.deleteMany({ where: { adminId: ADMIN } })
  await testPrisma.subscriptionCheckRun.deleteMany({ where: { startedAt: { gte: new Date('2032-01-01') } } })
  await testPrisma.subscription.deleteMany({ where: { userId: { startsWith: P } } })
  await testPrisma.user.deleteMany({ where: { id: { startsWith: P } } })
}

beforeAll(cleanup)
afterAll(async () => {
  await cleanup()
  await testPrisma.$disconnect()
})
beforeEach(async () => {
  await cleanup()
  bdapps.setSubscription.mockReset()
  bdapps.setSubscription.mockResolvedValue('UNREGISTERED')
  await testPrisma.user.create({ data: { id: ADMIN, phone: '+8801960000999', authMethod: 'OTP' } })
})

describe('each path that ends Pro records its reason', () => {
  it('daily subscription check -> DAILY_CHECK', async () => {
    await seedPro('chk', 1)
    await svc.runDailySubscriptionCheck({
      trigger: 'MANUAL',
      overrideDisabled: true, // other test files toggle the shared cron switch
      now: CHECK_NOW,
      clock: () => CHECK_NOW,
      getStatus: async (id) => {
        if (id !== SID('chk')) throw new Error('not ours')
        return 'UNREGISTERED'
      },
    })
    const ev = await events('chk')
    expect(ev.map((e) => e.reason)).toEqual(['DAILY_CHECK'])
    expect(ev[0].occurredAt).toEqual(CHECK_NOW)
  })

  it('BDApps unsubscribe (webhook) -> BDAPPS_UNSUBSCRIBE', async () => {
    await seedPro('hook', 2)
    await svc.syncBdappsSubscriptionBySubscriberId(SID('hook'), false, 'webhook')
    expect((await events('hook')).map((e) => e.reason)).toEqual(['BDAPPS_UNSUBSCRIBE'])
  })

  it('admin revoke -> ADMIN_REVOKE (revokePro and setSubscriptionStatus)', async () => {
    await seedPro('rev', 3)
    await seedPro('set', 4)
    await svc.revokePro(u('rev'), ADMIN, new Date())
    await svc.setSubscriptionStatus(u('set'), 'FREE', ADMIN, new Date())
    expect((await events('rev')).map((e) => e.reason)).toEqual(['ADMIN_REVOKE'])
    expect((await events('set')).map((e) => e.reason)).toEqual(['ADMIN_REVOKE'])
  })

  it('account deleted -> ACCOUNT_DELETED, at the injected time', async () => {
    await seedPro('del', 5)
    const now = new Date('2032-03-10T05:00:00Z')
    await svc.softDeleteUser(u('del'), ADMIN, now)
    const ev = await events('del')
    expect(ev.map((e) => e.reason)).toEqual(['ACCOUNT_DELETED'])
    expect(ev[0].occurredAt).toEqual(now)
  })

  it('records nothing for a user who was not Pro, or who stays Pro', async () => {
    await testPrisma.user.create({ data: { id: u('free'), phone: '+8801960000006', authMethod: 'OTP' } })
    await svc.softDeleteUser(u('free'), ADMIN, new Date())
    await seedPro('stay', 7)
    await svc.syncBdappsSubscriptionBySubscriberId(SID('stay'), true, 'webhook')
    expect(await events('free')).toEqual([])
    expect(await events('stay')).toEqual([])
  })
})

describe('getChurnSummary', () => {
  const at = (iso: string) => new Date(iso)
  async function ev(reason: 'DAILY_CHECK' | 'BDAPPS_UNSUBSCRIBE' | 'ADMIN_REVOKE' | 'ACCOUNT_DELETED', iso: string) {
    await testPrisma.churnEvent.create({ data: { reason, occurredAt: at(iso) } })
  }

  it('counts by reason in Bangladesh-day bounds and keeps admin revokes out of the rate', async () => {
    await testPrisma.proSnapshot.create({ data: { day: new Date('2032-04-09'), proCount: 50 } })
    await ev('DAILY_CHECK', '2032-04-09T18:00:00Z') // 10 April 00:00 BD: first instant of the range
    await ev('DAILY_CHECK', '2032-04-12T10:00:00Z')
    await ev('BDAPPS_UNSUBSCRIBE', '2032-04-12T11:00:00Z')
    await ev('ADMIN_REVOKE', '2032-04-13T11:00:00Z')
    await ev('ACCOUNT_DELETED', '2032-04-14T17:59:59Z') // 14 April 23:59:59 BD: last instant
    await ev('DAILY_CHECK', '2032-04-14T18:00:00Z') // 15 April BD: outside
    await ev('DAILY_CHECK', '2032-04-09T17:59:59Z') // 9 April BD: outside

    const s = await svc.getChurnSummary({ from: '2032-04-10', to: '2032-04-14' }, at('2032-06-01T00:00:00Z'))
    expect(s.byReason).toEqual({ DAILY_CHECK: 2, BDAPPS_UNSUBSCRIBE: 1, ADMIN_REVOKE: 1, ACCOUNT_DELETED: 1 })
    expect(s.churned).toBe(4)
    expect(s.proAtStart).toBe(50)
    expect(s.rate).toBeCloseTo(4 / 50)
  })

  it('has no rate without a snapshot for the day before the range, or with zero Pro', async () => {
    await ev('DAILY_CHECK', '2032-05-02T10:00:00Z')
    const none = await svc.getChurnSummary({ from: '2032-05-01', to: '2032-05-03' }, at('2032-06-01T00:00:00Z'))
    expect(none).toMatchObject({ churned: 1, proAtStart: null, rate: null })
    await testPrisma.proSnapshot.create({ data: { day: new Date('2032-04-30'), proCount: 0 } })
    const zero = await svc.getChurnSummary({ from: '2032-05-01', to: '2032-05-03' }, at('2032-06-01T00:00:00Z'))
    expect(zero).toMatchObject({ proAtStart: 0, rate: null })
  })

  it('returns zero counts for an empty range', async () => {
    const s = await svc.getChurnSummary({ from: '2032-07-01', to: '2032-07-02' }, at('2032-08-01T00:00:00Z'))
    expect(s.byReason).toEqual({ DAILY_CHECK: 0, BDAPPS_UNSUBSCRIBE: 0, ADMIN_REVOKE: 0, ACCOUNT_DELETED: 0 })
    expect(s.churned).toBe(0)
  })
})
