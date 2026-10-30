import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { testPrisma } from '../helpers/test-db'

// BDApps is the system boundary: stub it, keep the rest of the adapter real.
const bdapps = vi.hoisted(() => ({ setSubscription: vi.fn() }))
vi.mock('@vesta/shared/server/adapters/bdapps', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vesta/shared/server/adapters/bdapps')>()),
  ...bdapps,
}))

const svc = await import('@vesta/shared/server/services/user-service')

const P = 'test-sdr'
const USER = `${P}-user`
const ADMIN = `${P}-admin`
const MASKED = 'tel:dGVzdC1zZHItMQ'
const DAY = 24 * 60 * 60 * 1000

async function cleanup() {
  await testPrisma.adminAuditLog.deleteMany({ where: { adminId: ADMIN } })
  await testPrisma.subscription.deleteMany({ where: { userId: USER } })
  await testPrisma.user.deleteMany({ where: { id: { in: [USER, ADMIN] } } })
}

const audit = (action: string) => testPrisma.adminAuditLog.count({ where: { adminId: ADMIN, action } })

beforeAll(cleanup)
afterAll(async () => {
  await cleanup()
  await testPrisma.$disconnect()
})
beforeEach(async () => {
  await cleanup()
  bdapps.setSubscription.mockReset()
  bdapps.setSubscription.mockResolvedValue('UNREGISTERED')
  await testPrisma.user.create({ data: { id: ADMIN, phone: '+8801930000009', authMethod: 'OTP' } })
  await testPrisma.user.create({ data: { id: USER, phone: '+8801930000001', authMethod: 'OTP' } })
  await testPrisma.subscription.create({ data: { userId: USER, status: 'PRO', bdappsSubscriberId: MASKED } })
})

describe('suspend / delete unsubscribe on BDApps', () => {
  it('suspend unsubscribes and audits', async () => {
    const res = await svc.suspendUser(USER, ADMIN, 'abuse', new Date())
    expect(res.bdapps).toEqual({ status: 'unsubscribed' })
    expect(bdapps.setSubscription).toHaveBeenCalledWith(MASKED, 'unsubscribe')
    expect(await audit('USER_SUSPENDED')).toBe(1)
  })

  it('delete unsubscribes, records deletedAt and audits', async () => {
    const res = await svc.softDeleteUser(USER, ADMIN, new Date())
    expect(res.bdapps).toEqual({ status: 'unsubscribed' })
    expect(bdapps.setSubscription).toHaveBeenCalledWith(MASKED, 'unsubscribe')
    expect((await testPrisma.user.findUniqueOrThrow({ where: { id: USER } })).deletedAt).toBeInstanceOf(Date)
    expect(await audit('USER_DELETED')).toBe(1)
  })

  it('reports a BDApps failure but still applies suspend and delete', async () => {
    bdapps.setSubscription.mockRejectedValue(new Error('E1000 boom'))
    expect((await svc.suspendUser(USER, ADMIN, 'abuse', new Date())).bdapps).toEqual({ status: 'failed', error: 'E1000 boom' })
    expect((await svc.softDeleteUser(USER, ADMIN, new Date())).bdapps).toMatchObject({ status: 'failed' })
    const u = await testPrisma.user.findUniqueOrThrow({ where: { id: USER } })
    expect(u.suspendedAt).not.toBeNull()
    expect(u.deletedAt).not.toBeNull()
  })
})

describe('reactivate and restore never re-subscribe', () => {
  it('reactivate lifts the block without calling BDApps', async () => {
    await svc.suspendUser(USER, ADMIN, 'x', new Date())
    bdapps.setSubscription.mockClear()
    await svc.reactivateUser(USER, ADMIN)
    expect(bdapps.setSubscription).not.toHaveBeenCalled()
    expect((await testPrisma.user.findUniqueOrThrow({ where: { id: USER } })).suspendedAt).toBeNull()
  })

  it('restore clears deletedAt without calling BDApps, and audits', async () => {
    await svc.softDeleteUser(USER, ADMIN, new Date())
    bdapps.setSubscription.mockClear()
    await svc.restoreUser(USER, ADMIN, new Date())
    expect(bdapps.setSubscription).not.toHaveBeenCalled()
    expect((await testPrisma.user.findUniqueOrThrow({ where: { id: USER } })).deletedAt).toBeNull()
    expect(await audit('USER_RESTORED')).toBe(1)
  })
})

describe('30-day restore window', () => {
  it('allows restore at exactly 30 days and refuses just after', async () => {
    const deletedAt = new Date('2026-01-01T00:00:00Z')
    await testPrisma.user.update({ where: { id: USER }, data: { deletedAt } })
    await expect(svc.restoreUser(USER, ADMIN, new Date(deletedAt.getTime() + 30 * DAY + 1))).rejects.toMatchObject({
      code: 'RESTORE_WINDOW_EXPIRED',
    })
    expect((await testPrisma.user.findUniqueOrThrow({ where: { id: USER } })).deletedAt).not.toBeNull()
    await svc.restoreUser(USER, ADMIN, new Date(deletedAt.getTime() + 30 * DAY))
    expect((await testPrisma.user.findUniqueOrThrow({ where: { id: USER } })).deletedAt).toBeNull()
  })

  it('refuses to restore an account that is not deleted', async () => {
    await expect(svc.restoreUser(USER, ADMIN, new Date())).rejects.toMatchObject({ code: 'NOT_DELETED' })
  })
})
