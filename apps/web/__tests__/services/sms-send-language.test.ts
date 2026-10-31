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

const { createOneDayCampaign, createOneDayCampaignsBulk, sendCampaignMessage } = await import(
  '@vesta/shared/server/services'
)

const ADMIN = 'test-smslang-admin'
const NOW = new Date('2042-01-01T00:00:00Z')

async function cleanup() {
  await testPrisma.smsCampaign.deleteMany({ where: { createdBy: ADMIN } })
  await testPrisma.adminAuditLog.deleteMany({ where: { adminId: ADMIN } })
  await testPrisma.user.deleteMany({ where: { id: ADMIN } })
}

// The send language only decides how the admin's English/Bengali fields are composed into the
// campaign message's single body; what goes to the handsets is that body.
describe('SMS send language (composed into one body)', () => {
  beforeAll(async () => {
    await cleanup()
    await testPrisma.user.create({
      data: { id: ADMIN, phone: '+8801940000002', fullName: 'Admin', authMethod: 'OTP', profileCompleted: true },
    })
  })
  afterAll(cleanup)
  beforeEach(async () => {
    await testPrisma.smsCampaign.deleteMany({ where: { createdBy: ADMIN } })
    bdapps.smsSend.mockReset()
    bdapps.smsSend.mockResolvedValue({ requestId: 'r1', messageId: 'm1' })
  })

  it('sends only Bengali for BN', async () => {
    const c = await createOneDayCampaign(ADMIN, {
      message: 'Hello', messageBn: 'হ্যালো', sendLanguage: 'BN', scheduledFor: '2042-02-01T08:00:00Z', now: NOW,
    })
    await sendCampaignMessage(c.messages[0].id, ADMIN, NOW)
    expect(bdapps.smsSend).toHaveBeenCalledWith('হ্যালো', ['tel:all'])
  })

  it('defaults to BOTH and sends EN then BN', async () => {
    const c = await createOneDayCampaign(ADMIN, {
      message: 'Hello', messageBn: 'হ্যালো', scheduledFor: '2042-02-02T08:00:00Z', now: NOW,
    })
    await sendCampaignMessage(c.messages[0].id, ADMIN, NOW)
    expect(bdapps.smsSend).toHaveBeenCalledWith('Hello\nহ্যালো', ['tel:all'])
  })

  it('rejects BN without Bengali text and writes nothing', async () => {
    await expect(
      createOneDayCampaign(ADMIN, { message: 'Hello', sendLanguage: 'BN', scheduledFor: '2042-02-03T08:00:00Z', now: NOW }),
    ).rejects.toThrow()
    await expect(
      createOneDayCampaignsBulk(ADMIN, [{ messageEn: 'a', messageBn: 'ক' }, { messageEn: 'b' }], {
        startDate: '2042-02-10', sendLanguage: 'BN', now: NOW,
      }),
    ).rejects.toThrow()
    expect(await testPrisma.smsCampaign.count({ where: { createdBy: ADMIN } })).toBe(0)
  })

  it('bulk from CSV drafts honours own dates and language', async () => {
    const made = await createOneDayCampaignsBulk(
      ADMIN,
      [{ messageEn: 'x', messageBn: 'এক্স', scheduledDate: '2042-03-10' }, { messageEn: 'y', messageBn: 'ওয়াই' }],
      { startDate: '2042-04-01', sendLanguage: 'EN', now: NOW },
    )
    const rows = made.map((c) => c.messages[0])
    expect(rows.map((r) => r.day.toISOString().slice(0, 10))).toEqual(['2042-03-10', '2042-04-01'])
    expect(rows.map((r) => r.body)).toEqual(['x', 'y'])
    expect(rows.every((r) => r.status === 'PLANNED')).toBe(true)
  })
})
