import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { testPrisma } from '../helpers/test-db'

const bdapps = vi.hoisted(() => ({ smsSend: vi.fn() }))
vi.mock('@vesta/shared/server/adapters/bdapps', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vesta/shared/server/adapters/bdapps')>()),
  ...bdapps,
}))
vi.mock('@vesta/shared/utils/env', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@vesta/shared/utils/env')>()
  return { ...mod, env: { ...mod.env, DEV_MODE: false, NODE_ENV: 'test' } }
})
// The switch is a global row written by sms-delivery-report.test.ts; drive it from here instead.
const reports = vi.hoisted(() => ({ on: false }))
vi.mock('@vesta/shared/server/services/sms-settings-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vesta/shared/server/services/sms-settings-service')>()),
  getSmsDeliveryReports: async () => reports.on,
}))

const { planCampaign, sendCampaignMessage, recordSmsDeliveryReport } = await import('@vesta/shared/server/services')

const ADMIN = 'test-smsresults-admin'
const SUBS = ['test-smsresults-pro1', 'test-smsresults-pro2', 'test-smsresults-free']
const day = (n: number) => `2047-05-${String(n).padStart(2, '0')}`
const NOW = new Date('2047-05-01T00:00:00Z')

async function cleanup() {
  await testPrisma.smsCampaign.deleteMany({ where: { createdBy: ADMIN } })
  await testPrisma.adminAuditLog.deleteMany({ where: { adminId: ADMIN } })
  await testPrisma.user.deleteMany({ where: { id: { in: [ADMIN, ...SUBS] } } })
}

async function sendOne(d: string) {
  const c = await planCampaign(ADMIN, { name: `results ${d}`, messages: [{ day: d, body: 'Hi' }] })
  await sendCampaignMessage(c.messages[0].id, ADMIN, NOW)
  return testPrisma.smsCampaignMessage.findUniqueOrThrow({ where: { id: c.messages[0].id } })
}

describe('SMS send results: audience size and delivery-report request', () => {
  beforeAll(async () => {
    await cleanup()
    await testPrisma.user.create({ data: { id: ADMIN, phone: '+8801940000071', fullName: 'Admin', authMethod: 'OTP', profileCompleted: true } })
    // Two Pro subscribers with a BDApps id count toward the audience; a Free one does not.
    await testPrisma.user.create({ data: { id: SUBS[0], phone: '+8801940000072', fullName: 'P1', authMethod: 'OTP', subscriptions: { create: { status: 'PRO', bdappsSubscriberId: 'tel:p1' } } } })
    await testPrisma.user.create({ data: { id: SUBS[1], phone: '+8801940000073', fullName: 'P2', authMethod: 'OTP', subscriptions: { create: { status: 'PRO', bdappsSubscriberId: 'tel:p2' } } } })
    await testPrisma.user.create({ data: { id: SUBS[2], phone: '+8801940000074', fullName: 'F', authMethod: 'OTP', subscriptions: { create: { status: 'FREE', bdappsSubscriberId: 'tel:f' } } } })
  })
  afterAll(cleanup)
  beforeEach(async () => {
    await testPrisma.smsCampaign.deleteMany({ where: { createdBy: ADMIN } })
    reports.on = false
    bdapps.smsSend.mockReset()
    bdapps.smsSend.mockResolvedValue({ requestId: 'req-res', messageId: 'msg-res' })
  })

  it('stores the audience size and both provider ids; reports off requests none and leaves counts null', async () => {
    const m = await sendOne(day(1))
    expect(bdapps.smsSend).toHaveBeenCalledWith('Hi', ['tel:all'], 0)
    const expected = await testPrisma.subscription.count({ where: { status: 'PRO', bdappsSubscriberId: { not: null } } })
    expect(m.audienceSize).toBeGreaterThanOrEqual(2)
    expect(Math.abs((m.audienceSize ?? 0) - expected)).toBeLessThanOrEqual(5) // parallel files may add subscribers
    expect(m).toMatchObject({ providerRequestId: 'req-res', providerMessageId: 'msg-res', deliveredCount: null, failedCount: null })
  })

  it('reports on requests them and starts the counts at zero, which the webhook then moves', async () => {
    reports.on = true
    const m = await sendOne(day(2))
    expect(bdapps.smsSend).toHaveBeenCalledWith('Hi', ['tel:all'], 1)
    expect(m).toMatchObject({ deliveredCount: 0, failedCount: 0 })
    await recordSmsDeliveryReport('req-res', 'DELIVERED')
    const after = await testPrisma.smsCampaignMessage.findUniqueOrThrow({ where: { id: m.id } })
    expect(after.deliveredCount).toBe(1)
  })
})
