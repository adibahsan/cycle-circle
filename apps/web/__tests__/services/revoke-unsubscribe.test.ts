import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { testPrisma } from '../helpers/test-db'

// BDApps is the system boundary: stub unsubscribe, keep the rest of the adapter real.
const bdapps = vi.hoisted(() => ({ setSubscription: vi.fn() }))
vi.mock('@vesta/shared/server/adapters/bdapps', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vesta/shared/server/adapters/bdapps')>()),
  ...bdapps,
}))

const svc = await import('@vesta/shared/server/services/subscription-service')
const { logger } = await import('@vesta/shared/server/log')

const P = 'test-revoke'
const ids = { masked: `${P}-masked`, legacy: `${P}-legacy`, none: `${P}-none`, fail: `${P}-fail`, grant: `${P}-grant`, admin: `${P}-admin` }
const MASKED = 'tel:dGVzdC1yZXZva2UtMQ'
const MASKED_NEW = 'tel:dGVzdC1yZXZva2UtMg'

async function cleanup() {
  const userIds = Object.values(ids)
  await testPrisma.adminAuditLog.deleteMany({ where: { adminId: ids.admin } })
  await testPrisma.subscription.deleteMany({ where: { userId: { in: userIds } } })
  await testPrisma.user.deleteMany({ where: { id: { in: userIds } } })
}

async function seed(key: keyof typeof ids, subscriberId: string | null, n: number) {
  await testPrisma.user.create({
    data: { id: ids[key], phone: `+88019200000${n}`, authMethod: 'OTP', subscriptionStatus: 'PRO' },
  })
  await testPrisma.subscription.create({
    data: { userId: ids[key], status: 'PRO', bdappsSubscriberId: subscriberId },
  })
}

const state = (key: keyof typeof ids) =>
  testPrisma.user.findUniqueOrThrow({ where: { id: ids[key] }, select: { subscriptionStatus: true } })
const sub = (key: keyof typeof ids) => testPrisma.subscription.findFirstOrThrow({ where: { userId: ids[key] } })

beforeAll(cleanup)
afterAll(async () => {
  await cleanup()
  await testPrisma.$disconnect()
})
beforeEach(async () => {
  await cleanup()
  bdapps.setSubscription.mockReset()
  bdapps.setSubscription.mockResolvedValue('UNREGISTERED')
  await seed('masked', MASKED, 1)
  await seed('legacy', '+8801920000002', 2)
  await seed('none', null, 3)
  await seed('fail', MASKED, 4)
  await seed('grant', null, 5)
  await testPrisma.user.create({ data: { id: ids.admin, phone: '+8801920000009', authMethod: 'OTP' } })
})

describe('unsubscribeUserOnBdapps', () => {
  it('unsubscribes the stored masked id', async () => {
    expect(await svc.unsubscribeUserOnBdapps(ids.masked)).toEqual({ status: 'unsubscribed' })
    expect(bdapps.setSubscription).toHaveBeenCalledWith(MASKED, 'unsubscribe')
  })

  it('skips legacy phone ids and users without a subscriber id', async () => {
    expect(await svc.unsubscribeUserOnBdapps(ids.legacy)).toMatchObject({ status: 'skipped' })
    expect(await svc.unsubscribeUserOnBdapps(ids.none)).toMatchObject({ status: 'skipped' })
    expect(bdapps.setSubscription).not.toHaveBeenCalled()
  })

  it('reports a BDApps failure instead of throwing', async () => {
    bdapps.setSubscription.mockRejectedValue(new Error('E1000 boom'))
    expect(await svc.unsubscribeUserOnBdapps(ids.fail)).toEqual({ status: 'failed', error: 'E1000 boom' })
  })
})

describe('revokePro', () => {
  it('sets a Free override, unsubscribes on BDApps and writes a translog line', async () => {
    const spy = vi.spyOn(logger, 'translog')
    const res = await svc.revokePro(ids.masked, ids.admin)
    expect(res.bdapps).toEqual({ status: 'unsubscribed' })
    expect((await state('masked')).subscriptionStatus).toBe('LAPSED')
    expect(await sub('masked')).toMatchObject({ adminOverride: true, adminOverrideUnsubFailed: false })
    expect(spy).toHaveBeenCalledWith('plan.change', expect.objectContaining({ to: 'LAPSED', cause: 'admin' }), { userId: ids.masked })
    spy.mockRestore()
  })

  it('still applies on our side when BDApps fails, and says so', async () => {
    bdapps.setSubscription.mockRejectedValue(new Error('down'))
    const res = await svc.revokePro(ids.fail, ids.admin)
    expect(res.bdapps).toMatchObject({ status: 'failed' })
    expect((await state('fail')).subscriptionStatus).toBe('LAPSED')
    expect((await sub('fail')).adminOverrideUnsubFailed).toBe(true)
  })

  it('setSubscriptionStatus FREE/LAPSED unsubscribes, PRO does not', async () => {
    await svc.setSubscriptionStatus(ids.masked, 'FREE', ids.admin)
    expect(bdapps.setSubscription).toHaveBeenCalledTimes(1)
    await svc.setSubscriptionStatus(ids.masked, 'PRO', ids.admin)
    expect(bdapps.setSubscription).toHaveBeenCalledTimes(1)
  })
})

describe('override ends on re-subscription', () => {
  it('REGISTERED after a successful revoke ends the override and the user is Pro again', async () => {
    await svc.revokePro(ids.masked, ids.admin)
    expect(await svc.applyBdappsSubscription(ids.masked, MASKED, false, 'webhook')).toBe('LAPSED')
    expect(await svc.applyBdappsSubscription(ids.masked, MASKED, true, 'webhook')).toBe('PRO')
    expect(await svc.hasAdminOverride(ids.masked)).toBe(false)
  })

  it('a repeat REGISTERED does not end the override when the unsubscribe failed', async () => {
    bdapps.setSubscription.mockRejectedValue(new Error('down'))
    await svc.revokePro(ids.fail, ids.admin)
    expect(await svc.applyBdappsSubscription(ids.fail, MASKED, true, 'webhook')).toBe('LAPSED')
    expect(await svc.hasAdminOverride(ids.fail)).toBe(true)
    // a new masked id is a new subscription
    expect(await svc.applyBdappsSubscription(ids.fail, MASKED_NEW, true, 'otp-verify')).toBe('PRO')
    expect(await svc.hasAdminOverride(ids.fail)).toBe(false)
  })

  it('Grant Pro is cleared by the same rule', async () => {
    await svc.grantPro(ids.grant, ids.admin)
    expect(await svc.applyBdappsSubscription(ids.grant, MASKED, false, 'nightly-check')).toBe('PRO')
    expect(await svc.hasAdminOverride(ids.grant)).toBe(true)
    expect(await svc.applyBdappsSubscription(ids.grant, MASKED, true, 'otp-verify')).toBe('PRO')
    expect(await svc.hasAdminOverride(ids.grant)).toBe(false)
  })

  it('a skipped unsubscribe (no usable id) behaves like a failed one', async () => {
    await svc.revokePro(ids.none, ids.admin)
    expect((await sub('none')).adminOverrideUnsubFailed).toBe(true)
    // absent old id: a REGISTERED report is just the old status, not a new subscription
    expect(await svc.applyBdappsSubscription(ids.none, MASKED, true, 'webhook')).toBe('LAPSED')
    expect(await svc.hasAdminOverride(ids.none)).toBe(true)

    await svc.revokePro(ids.legacy, ids.admin)
    expect(await svc.applyBdappsSubscription(ids.legacy, '+8801920000002', true, 'webhook')).toBe('LAPSED')
    expect(await svc.hasAdminOverride(ids.legacy)).toBe(true)
    // a masked id is a genuinely new subscription
    expect(await svc.applyBdappsSubscription(ids.legacy, MASKED_NEW, true, 'otp-verify')).toBe('PRO')
    expect(await svc.hasAdminOverride(ids.legacy)).toBe(false)
  })

  it('webhook compares the payload id with the override id ignoring the tel: prefix', async () => {
    bdapps.setSubscription.mockRejectedValue(new Error('down'))
    await svc.revokePro(ids.fail, ids.admin) // override row stores tel:<x>, unsubscribe failed
    // a newer row for the same user holding the bare form of the same id
    await testPrisma.subscription.create({
      data: { userId: ids.fail, status: 'LAPSED', bdappsSubscriberId: MASKED.replace(/^tel:/, '') },
    })
    const res = await svc.syncBdappsSubscriptionBySubscriberId(MASKED, true, 'webhook')
    expect(res).toMatchObject({ userId: ids.fail, status: 'LAPSED' })
    expect(await svc.hasAdminOverride(ids.fail)).toBe(true)
  })

  it('listRevokedSubscribers returns revoked masked users, including failed unsubscribes, never skipped ones', async () => {
    await svc.revokePro(ids.masked, ids.admin)
    bdapps.setSubscription.mockRejectedValue(new Error('down'))
    await svc.revokePro(ids.fail, ids.admin)
    await svc.revokePro(ids.none, ids.admin) // skipped, no id
    await svc.revokePro(ids.legacy, ids.admin) // skipped, phone id
    const mine = (await svc.listRevokedSubscribers())
      .filter((r) => r.userId.startsWith(P))
      .sort((a, b) => a.userId.localeCompare(b.userId))
    expect(mine).toEqual([
      { userId: ids.fail, subscriberId: MASKED },
      { userId: ids.masked, subscriberId: MASKED },
    ])
  })
})
