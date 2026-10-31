import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { testPrisma } from '../helpers/test-db'

const svc = await import('@vesta/shared/server/services/user-service')

const P = 'test-aud'
const USER = `${P}-user`
const PROFILE = `${P}-profile`

async function cleanup() {
  await testPrisma.user.deleteMany({ where: { id: USER } })
}

beforeAll(cleanup)
afterAll(async () => {
  await cleanup()
  await testPrisma.$disconnect()
})
beforeEach(async () => {
  await cleanup()
  await testPrisma.user.create({
    data: {
      id: USER,
      phone: '+8801940000001',
      authMethod: 'OTP',
      fullName: 'Detail User',
      passwordHash: 'SECRET-HASH',
      suspendedBy: 'someone',
      profiles: { create: { id: PROFILE, name: 'Self', relation: 'SELF' } },
    },
  })
})

describe('getUserDetailForAdmin', () => {
  it('never returns secret columns', async () => {
    const user = await svc.getUserDetailForAdmin(USER)
    expect(user).not.toBeNull()
    expect(user).not.toHaveProperty('passwordHash')
    expect(user).not.toHaveProperty('sessionsValidAfter')
    expect(user).not.toHaveProperty('suspendedBy')
    expect(JSON.stringify(user)).not.toContain('SECRET-HASH')
    expect(user).toMatchObject({ id: USER, fullName: 'Detail User' })
  })

  it('returns null for an unknown id instead of throwing', async () => {
    await expect(svc.getUserDetailForAdmin('does-not-exist')).resolves.toBeNull()
  })

  it('bounds subscriptions to the 10 most recent', async () => {
    const base = new Date('2026-01-01T00:00:00Z').getTime()
    await testPrisma.subscription.createMany({
      data: Array.from({ length: 12 }, (_, i) => ({ userId: USER, createdAt: new Date(base + i * 1000) })),
    })
    const user = await svc.getUserDetailForAdmin(USER)
    expect(user!.subscriptions).toHaveLength(10)
    expect(user!.subscriptions[0].createdAt.getTime()).toBe(base + 11 * 1000)
  })

  // Prediction.profileId is @unique, so the DB holds at most one per profile; `take: 10` is
  // a defensive cap that the select must keep, and the nested shape must stay narrow.
  it('returns predictions with a narrow shape', async () => {
    const at = new Date('2026-01-01T00:00:00Z')
    await testPrisma.prediction.create({
      data: { profileId: PROFILE, tier: 'AVERAGE', nextPeriodStart: at, ovulationDay: at, fertileStart: at, fertileEnd: at, confidence: 0.5 },
    })
    const user = await svc.getUserDetailForAdmin(USER)
    expect(user!.profiles[0].predictions).toHaveLength(1)
    expect(user!.profiles[0].predictions[0]).not.toHaveProperty('profileId')
  })
})
