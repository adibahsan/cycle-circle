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

// The delivery-report switch is one global row that sms-delivery-report.test.ts writes; pin it
// off here so these tests never see a value that file left behind.
vi.mock('@vesta/shared/server/services/sms-settings-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vesta/shared/server/services/sms-settings-service')>()),
  getSmsDeliveryReports: async () => false,
}))

const { planCampaign, sendCampaignMessage } = await import(
  '@vesta/shared/server/services'
)

const ADMIN = 'test-smslang-admin'
const NOW = new Date('2042-01-01T00:00:00Z')

async function cleanup() {
  await testPrisma.smsCampaign.deleteMany({ where: { createdBy: ADMIN } })
  await testPrisma.adminAuditLog.deleteMany({ where: { adminId: ADMIN } })
  await testPrisma.user.deleteMany({ where: { id: ADMIN } })
}

// What goes to the handsets is the campaign message's stored body, verbatim.
describe('SMS send body', () => {
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

  it('sends the stored body, Bengali and multi-line included', async () => {
    const c = await planCampaign(ADMIN, { name: 'Body', messages: [{ day: '2042-02-02', body: 'Hello\nহ্যালো' }] })
    await sendCampaignMessage(c.messages[0].id, ADMIN, NOW)
    expect(bdapps.smsSend).toHaveBeenCalledWith('Hello\nহ্যালো', ['tel:all'], 0)
  })
})
