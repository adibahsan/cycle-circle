import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { testPrisma } from '../helpers/test-db'
import {
  applyBdappsSubscription,
  hasAdminOverride,
  listBdappsSubscribers,
} from '@vesta/shared/server/services/subscription-service'
import { keepAccountWithVerifiedPhone } from '@vesta/shared/server/services/user-service'

const P = 'test-bdsub'
const ids = {
  overrideOld: `${P}-override-old`,
  legacy: `${P}-legacy`,
  legacyOverride: `${P}-legacy-override`,
  both: `${P}-both`,
  trial: `${P}-trial`,
}
const phones = {
  overrideOld: '+8801900000001',
  legacy: '+8801900000002',
  legacyOverride: '+8801900000003',
  both: '+8801900000004',
  trial: '+8801900000005',
}

async function cleanup() {
  const userIds = Object.values(ids)
  await testPrisma.subscription.deleteMany({ where: { userId: { in: userIds } } })
  await testPrisma.user.deleteMany({ where: { id: { in: userIds } } })
}

beforeAll(async () => {
  await cleanup()
  const mk = (key: keyof typeof ids, status: 'FREE' | 'PRO', extra = {}) =>
    testPrisma.user.create({
      data: { id: ids[key], phone: phones[key], authMethod: 'OTP', subscriptionStatus: status, ...extra },
    })
  await mk('overrideOld', 'PRO')
  await mk('legacy', 'PRO')
  await mk('legacyOverride', 'PRO')
  await mk('both', 'PRO')
  await mk('trial', 'FREE', { emailTrialExpiresAt: new Date('2030-01-01') })

  // admin override on an OLDER row, newer plain row
  await testPrisma.subscription.create({
    data: { userId: ids.overrideOld, status: 'PRO', adminOverride: true, createdAt: new Date('2026-01-01') },
  })
  await testPrisma.subscription.create({
    data: { userId: ids.overrideOld, status: 'PRO', createdAt: new Date('2026-02-01') },
  })
  await testPrisma.subscription.create({
    data: { userId: ids.legacyOverride, status: 'PRO', adminOverride: true },
  })
  await testPrisma.subscription.create({
    data: { userId: ids.both, status: 'PRO', bdappsSubscriberId: phones.both },
  })
})

afterAll(async () => {
  await cleanup()
  await testPrisma.$disconnect()
})

describe('hasAdminOverride', () => {
  it('is true when any row has an override, even an older one', async () => {
    expect(await hasAdminOverride(ids.overrideOld)).toBe(true)
    expect(await hasAdminOverride(ids.both)).toBe(false)
    expect(await hasAdminOverride(ids.legacy)).toBe(false)
  })
})

describe('applyBdappsSubscription', () => {
  it('honours an override on an older row (does not downgrade)', async () => {
    const status = await applyBdappsSubscription(ids.overrideOld, phones.overrideOld, false)
    expect(status).toBe('PRO')
    const user = await testPrisma.user.findUniqueOrThrow({ where: { id: ids.overrideOld } })
    expect(user.subscriptionStatus).toBe('PRO')
  })
})

describe('listBdappsSubscribers', () => {
  it('includes subscription rows and legacy phone PRO users, deduped, minus overrides', async () => {
    const list = (await listBdappsSubscribers()).filter((s) => s.userId.startsWith(P))
    const byUser = Object.fromEntries(list.map((s) => [s.userId, s.phone]))
    expect(byUser[ids.both]).toBe(phones.both)
    expect(byUser[ids.legacy]).toBe(phones.legacy)
    expect(ids.legacyOverride in byUser).toBe(false)
    expect(ids.overrideOld in byUser).toBe(false)
    expect(list.filter((s) => s.userId === ids.both)).toHaveLength(1)
  })
})

describe('keepAccountWithVerifiedPhone', () => {
  it('keeps the email trial when the number is not registered', async () => {
    await keepAccountWithVerifiedPhone(ids.trial, phones.trial, false)
    const user = await testPrisma.user.findUniqueOrThrow({ where: { id: ids.trial } })
    expect(user.phone).toBe(phones.trial)
    expect(user.emailTrialExpiresAt).not.toBeNull()
  })

  it('clears the email trial when registered', async () => {
    await keepAccountWithVerifiedPhone(ids.trial, phones.trial, true)
    const user = await testPrisma.user.findUniqueOrThrow({ where: { id: ids.trial } })
    expect(user.emailTrialExpiresAt).toBeNull()
    expect(user.subscriptionStatus).toBe('PRO')
  })
})
