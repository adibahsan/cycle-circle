import { describe, it, expect, vi, beforeEach } from 'vitest'

// Fake bcrypt: a stored hash "HASH:<pw>" matches only that password; the dummy hash never does.
const compare = vi.hoisted(() => vi.fn(async (pw: string, hash: string) => hash === `HASH:${pw}`))
vi.mock('bcryptjs', () => ({ default: { compare }, compare }))

const db = vi.hoisted(() => ({
  user: { findFirst: vi.fn(), update: vi.fn() },
  adminAuditLog: { create: vi.fn() },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../../utils/env', () => ({ env: { AUTH_COOKIE_NAME: 'test', NODE_ENV: 'test' } }))
vi.mock('../../utils/auth-token', () => ({ ADMIN_AUDIENCE: 'a', WEB_AUDIENCE: 'w', signAuthToken: vi.fn(), verifyAuthToken: vi.fn() }))
vi.mock('../adapters/redis', () => ({ blacklistJti: vi.fn(), isJtiBlacklisted: vi.fn(), getSessionsValidAfterCache: vi.fn(), setSessionsValidAfterCache: vi.fn(), peekRateLimit: vi.fn(), recordRateLimitHit: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }) }))

const { verifyAdminLogin } = await import('../auth')

const PASSWORD = 'correct-horse-battery'
const hash = `HASH:${PASSWORD}`
const now = new Date('2026-01-01T00:00:00Z')
const admin = (over: Record<string, unknown> = {}) => ({
  id: 'a1', email: 'Admin@Vesta.health', role: 'ADMIN', passwordHash: hash, suspendedAt: null, deletedAt: null, ...over,
})

beforeEach(() => {
  db.user.findFirst.mockReset()
  db.user.update.mockReset()
  compare.mockClear()
})

describe('verifyAdminLogin', () => {
  it('returns the admin for the right password', async () => {
    db.user.findFirst.mockResolvedValue(admin())
    await expect(verifyAdminLogin('admin@vesta.health', PASSWORD, now)).resolves.toMatchObject({ id: 'a1' })
  })

  it('looks the email up case-insensitively', async () => {
    db.user.findFirst.mockResolvedValue(admin())
    await verifyAdminLogin('admin@vesta.health', PASSWORD, now)
    expect(db.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'admin@vesta.health', mode: 'insensitive' } },
    })
  })

  it('still runs a bcrypt compare for an unknown email, then refuses with 401', async () => {
    db.user.findFirst.mockResolvedValue(null)
    await expect(verifyAdminLogin('nobody@x.test', 'whatever', now)).rejects.toMatchObject({
      statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password',
    })
    expect(compare).toHaveBeenCalledTimes(1)
  })

  it('still compares for a non-admin and for a user without a hash', async () => {
    db.user.findFirst.mockResolvedValue(admin({ role: 'USER' }))
    await expect(verifyAdminLogin('u@x.test', PASSWORD, now)).rejects.toMatchObject({ statusCode: 401 })
    db.user.findFirst.mockResolvedValue(admin({ passwordHash: null }))
    await expect(verifyAdminLogin('u@x.test', PASSWORD, now)).rejects.toMatchObject({ statusCode: 401 })
    expect(compare).toHaveBeenCalledTimes(2)
  })

  it('rejects a wrong password with 401', async () => {
    db.user.findFirst.mockResolvedValue(admin())
    await expect(verifyAdminLogin('admin@vesta.health', 'nope', now)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('refuses a suspended admin with 403', async () => {
    db.user.findFirst.mockResolvedValue(admin({ suspendedAt: now }))
    await expect(verifyAdminLogin('admin@vesta.health', PASSWORD, now)).rejects.toMatchObject({ statusCode: 403 })
  })
})
