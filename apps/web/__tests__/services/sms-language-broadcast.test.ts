import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { testPrisma } from '../helpers/test-db'

const bdapps = vi.hoisted(() => ({ smsSend: vi.fn() }))
vi.mock('@vesta/shared/server/adapters/bdapps', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vesta/shared/server/adapters/bdapps')>()),
  ...bdapps,
}))
// Take the real send path (not the DEV_MODE console shortcut)
vi.mock('@vesta/shared/utils/env', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@vesta/shared/utils/env')>()
  return { ...mod, env: { ...mod.env, DEV_MODE: false, NODE_ENV: 'test' } }
})

const { createBroadcast, createBroadcastsBulk, sendBroadcast } = await import(
  '@vesta/shared/server/services'
)

const ADMIN = 'test-smslang-admin'

async function cleanup() {
  await testPrisma.smsBroadcast.deleteMany({ where: { createdBy: ADMIN } })
  await testPrisma.adminAuditLog.deleteMany({ where: { adminId: ADMIN } })
  await testPrisma.user.deleteMany({ where: { id: ADMIN } })
}

describe('SMS send language', () => {
  beforeAll(async () => {
    await cleanup()
    await testPrisma.user.create({
      data: { id: ADMIN, phone: '+8801940000002', fullName: 'Admin', authMethod: 'OTP', profileCompleted: true },
    })
  })
  afterAll(async () => {
    await cleanup()
  })
  beforeEach(() => {
    bdapps.smsSend.mockReset()
    bdapps.smsSend.mockResolvedValue({ messageId: 'm1' })
  })

  it('stores the language and sends only Bengali for BN', async () => {
    const b = await createBroadcast(ADMIN, 'Hello', 'হ্যালো', undefined, 'BN')
    expect(b.sendLanguage).toBe('BN')
    await sendBroadcast(b.id, ADMIN, new Date())
    expect(bdapps.smsSend).toHaveBeenCalledWith('হ্যালো', ['tel:all'])
  })

  it('defaults to BOTH and sends EN then BN', async () => {
    const b = await createBroadcast(ADMIN, 'Hello', 'হ্যালো')
    expect(b.sendLanguage).toBe('BOTH')
    await sendBroadcast(b.id, ADMIN, new Date())
    expect(bdapps.smsSend).toHaveBeenCalledWith('Hello\nহ্যালো', ['tel:all'])
  })

  it('rejects BN without Bengali text and writes nothing', async () => {
    await expect(createBroadcast(ADMIN, 'Hello', undefined, undefined, 'BN')).rejects.toThrow()
    await expect(
      createBroadcastsBulk(ADMIN, [{ messageEn: 'a', messageBn: 'ক' }, { messageEn: 'b' }], '2027-01-01', 'BN'),
    ).rejects.toThrow()
    expect(await testPrisma.smsBroadcast.count({ where: { createdBy: ADMIN, message: { in: ['a', 'b'] } } })).toBe(0)
  })

  it('bulk from CSV drafts honours own dates and language', async () => {
    const rows = await createBroadcastsBulk(
      ADMIN,
      [{ messageEn: 'x', messageBn: 'এক্স', scheduledDate: '2027-02-10' }, { messageEn: 'y', messageBn: 'ওয়াই' }],
      '2027-03-01',
      'EN',
    )
    expect(rows.map((r) => r.scheduledFor?.toISOString())).toEqual([
      '2027-02-10T08:00:00.000Z',
      '2027-03-01T08:00:00.000Z',
    ])
    expect(rows.every((r) => r.sendLanguage === 'EN' && r.status === 'SCHEDULED')).toBe(true)
  })
})
