import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { testPrisma } from '../helpers/test-db'
import { ensureAdminUser } from '../../../../packages/shared/prisma/seed-admin'

const EMAIL = 'test-seed-admin@example.test'
const PROD_MSG = 'ADMIN_PASSWORD must be set to a strong value when NODE_ENV=production'

const cleanup = () => testPrisma.user.deleteMany({ where: { email: EMAIL } })

beforeAll(cleanup)
beforeEach(cleanup)
afterAll(async () => {
  await cleanup()
  await testPrisma.$disconnect()
})

describe('ensureAdminUser', () => {
  it('creates an ADMIN with a hashed password when missing', async () => {
    const res = await ensureAdminUser(testPrisma, { email: EMAIL, password: 'Str0ng-pass-1', nodeEnv: 'production' })
    expect(res.status).toBe('created')
    const row = await testPrisma.user.findUniqueOrThrow({ where: { email: EMAIL } })
    expect(row.id).toBe(res.id)
    expect(row.role).toBe('ADMIN')
    expect(row.passwordHash).toMatch(/^\$2[aby]\$12\$/)
    expect(row.passwordHash).not.toContain('Str0ng-pass-1')
  })

  it('leaves an existing user completely untouched', async () => {
    const existing = await testPrisma.user.create({
      data: { email: EMAIL, authMethod: 'EMAIL', role: 'USER', passwordHash: 'original-hash' },
    })
    const res = await ensureAdminUser(testPrisma, { email: EMAIL, password: 'Another-str0ng-1', nodeEnv: 'production' })
    expect(res).toEqual({ status: 'exists', id: existing.id })
    const row = await testPrisma.user.findUniqueOrThrow({ where: { email: EMAIL } })
    expect(row.passwordHash).toBe('original-hash')
    expect(row.role).toBe('USER')
  })

  it.each([undefined, '', 'admin123'])('refuses in production with password %j and writes nothing', async (password) => {
    await expect(
      ensureAdminUser(testPrisma, { email: EMAIL, password, nodeEnv: 'production' }),
    ).rejects.toThrow(PROD_MSG)
    expect(await testPrisma.user.count({ where: { email: EMAIL } })).toBe(0)
  })

  it('allows the admin123 default outside production', async () => {
    const res = await ensureAdminUser(testPrisma, { email: EMAIL, password: undefined, nodeEnv: 'development' })
    expect(res.status).toBe('created')
  })
})
