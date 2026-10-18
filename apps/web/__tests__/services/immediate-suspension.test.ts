import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { SignJWT } from 'jose'
import { testPrisma } from '../helpers/test-db'

// The auth cookie is the only request input verifyAuth reads.
const cookie = vi.hoisted(() => ({ token: '' as string }))
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => (cookie.token ? { value: cookie.token } : undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}))

const { verifyAuth, isIssuedBeforeMarker, bumpSessionsValidAfter } = await import('@vesta/shared/server/auth')
const { suspendUser, reactivateUser } = await import('@vesta/shared/server/services/user-service')
const { env } = await import('@vesta/shared/utils/env')

const { setSessionsValidAfterCache } = await import('@vesta/shared/server/adapters/redis')

const P = 'test-suspend'
const USER = `${P}-user`
const ADMIN = `${P}-admin`

/** Signs a session token with an explicit issued-at (epoch seconds). */
async function tokenIssuedAt(sub: string, iatSeconds: number) {
  return new SignJWT({ role: 'USER' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setJti(crypto.randomUUID())
    .setIssuedAt(iatSeconds)
    .setExpirationTime(iatSeconds + 3600 * 24)
    .sign(new TextEncoder().encode(env.JWT_SECRET))
}

async function cleanup() {
  await testPrisma.adminAuditLog.deleteMany({ where: { adminId: ADMIN } })
  await testPrisma.user.deleteMany({ where: { id: { in: [USER, ADMIN] } } })
}

beforeAll(async () => {
  await cleanup()
  await testPrisma.user.create({ data: { id: ADMIN, email: `${ADMIN}@example.test`, authMethod: 'EMAIL', role: 'ADMIN' } })
  await testPrisma.user.create({ data: { id: USER, phone: '+8801920000001', authMethod: 'OTP' } })
})
afterAll(cleanup)

describe('isIssuedBeforeMarker', () => {
  it('has no effect without a marker', () => {
    expect(isIssuedBeforeMarker(100, null)).toBe(false)
    expect(isIssuedBeforeMarker(100, 0)).toBe(false)
  })
  it('rejects tokens at or before the marker second, accepts later ones', () => {
    expect(isIssuedBeforeMarker(99, 100_500)).toBe(true)
    expect(isIssuedBeforeMarker(100, 100_500)).toBe(true)
    expect(isIssuedBeforeMarker(101, 100_500)).toBe(false)
  })
})

describe('immediate suspension', () => {
  it('requires a reason and stores it in the audit entry', async () => {
    await expect(suspendUser(USER, ADMIN, '   ')).rejects.toMatchObject({ code: 'REASON_REQUIRED' })
    expect(await testPrisma.user.findUnique({ where: { id: USER } })).toMatchObject({ suspendedAt: null })

    await suspendUser(USER, ADMIN, ' Abusive messages ')
    const log = await testPrisma.adminAuditLog.findFirst({ where: { adminId: ADMIN, action: 'USER_SUSPENDED', targetId: USER } })
    expect(log?.metadata).toEqual({ reason: 'Abusive messages' })
    await reactivateUser(USER, ADMIN)
  })

  it('rejects a token issued before suspension, accepts one issued after reactivation', async () => {
    // Start from a clean slate (the previous test left a marker behind).
    await testPrisma.user.update({ where: { id: USER }, data: { sessionsValidAfter: null } })
    await setSessionsValidAfterCache(USER, 0)
    const now = Math.floor(Date.now() / 1000)
    const before = await tokenIssuedAt(USER, now - 10)

    cookie.token = before
    expect(await verifyAuth()).not.toBeNull()

    await suspendUser(USER, ADMIN, 'test')
    expect(await verifyAuth()).toBeNull() // immediate, no cache window

    await reactivateUser(USER, ADMIN)
    expect(await verifyAuth()).toBeNull() // old sessions stay dead after reactivation

    cookie.token = await tokenIssuedAt(USER, now + 5)
    expect(await verifyAuth()).not.toBeNull()
  })

  it('reads the marker from the database when the session store has no entry', async () => {
    const marker = await bumpSessionsValidAfter(USER)
    const row = await testPrisma.user.findUnique({ where: { id: USER } })
    expect(row?.sessionsValidAfter?.getTime()).toBe(marker.getTime())

    const iat = Math.floor(marker.getTime() / 1000)
    cookie.token = await tokenIssuedAt(USER, iat - 1)
    expect(await verifyAuth()).toBeNull()
    cookie.token = await tokenIssuedAt(USER, iat + 1)
    expect(await verifyAuth()).not.toBeNull()
  })
})
