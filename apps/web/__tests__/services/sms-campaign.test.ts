import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { testPrisma } from '../helpers/test-db'
import {
  planCampaign,
  createOneDayCampaign,
  createOneDayCampaignsBulk,
  deleteCampaign,
  deriveCampaignStatus,
  listCampaigns,
  getCampaign,
  getNextPlannedCampaignId,
  campaignNameFor,
} from '@vesta/shared/server/services'

const ADMIN = 'test-smscampaign-admin'
const day = (n: number) => `2043-05-${String(n).padStart(2, '0')}`

async function cleanup() {
  await testPrisma.smsCampaign.deleteMany({ where: { createdBy: ADMIN } })
  await testPrisma.adminAuditLog.deleteMany({ where: { adminId: ADMIN } })
  await testPrisma.user.deleteMany({ where: { id: ADMIN } })
}

describe('deriveCampaignStatus', () => {
  const none = { cancelledAt: null }
  it('cancelled wins over everything', () => {
    expect(deriveCampaignStatus({ cancelledAt: new Date() }, [{ status: 'SENT' }])).toBe('cancelled')
  })
  it('planned when nothing has been sent, failed or missed', () => {
    expect(deriveCampaignStatus(none, [{ status: 'PLANNED' }, { status: 'PLANNED' }])).toBe('planned')
    expect(deriveCampaignStatus(none, [])).toBe('planned')
  })
  it('running while something is done and something is still planned', () => {
    expect(deriveCampaignStatus(none, [{ status: 'SENT' }, { status: 'PLANNED' }])).toBe('running')
    expect(deriveCampaignStatus(none, [{ status: 'SENDING' }, { status: 'PLANNED' }])).toBe('running')
    expect(deriveCampaignStatus(none, [{ status: 'FAILED' }, { status: 'PLANNED' }])).toBe('running')
  })
  it('finished once no message is left to go out', () => {
    expect(deriveCampaignStatus(none, [{ status: 'SENT' }, { status: 'FAILED' }, { status: 'MISSED' }])).toBe('finished')
    expect(deriveCampaignStatus(none, [{ status: 'SENDING' }])).toBe('finished')
  })
})

describe('campaign names', () => {
  it('is the first 40 characters of the text plus the day', () => {
    expect(campaignNameFor('Hello\n  world', '2026-11-01')).toBe('Hello world 2026-11-01')
    expect(campaignNameFor('x'.repeat(50), '2026-11-01')).toBe(`${'x'.repeat(40)} 2026-11-01`)
  })
})

describe('campaigns (db)', () => {
  beforeAll(async () => {
    await cleanup()
    await testPrisma.user.create({
      data: { id: ADMIN, phone: '+8801940000007', fullName: 'Campaign Admin', authMethod: 'OTP', profileCompleted: true },
    })
  })
  afterAll(cleanup)
  beforeEach(async () => {
    await testPrisma.smsCampaign.deleteMany({ where: { createdBy: ADMIN } })
  })

  it('plans a campaign with gaps, one message per day, and audits it', async () => {
    const c = await planCampaign(ADMIN, {
      name: 'Fridays',
      messages: [{ day: day(1), body: 'one' }, { day: day(8), body: 'two' }, { day: day(15), body: 'three' }],
    })
    const got = await getCampaign(c.id)
    expect(got?.status).toBe('planned')
    expect(got?.messages.map((m) => m.day.toISOString().slice(0, 10))).toEqual([day(1), day(8), day(15)])
    const log = await testPrisma.adminAuditLog.findFirst({ where: { adminId: ADMIN, targetId: c.id } })
    expect(log).toMatchObject({ action: 'CREATE_SMS_CAMPAIGN', targetType: 'SmsCampaign' })
  })

  it('refuses a day another campaign uses, naming that campaign, and writes nothing', async () => {
    await planCampaign(ADMIN, { name: 'First', messages: [{ day: day(2), body: 'a' }] })
    await expect(
      planCampaign(ADMIN, { name: 'Second', messages: [{ day: day(1), body: 'b' }, { day: day(2), body: 'c' }] }),
    ).rejects.toThrow(/"First"/)
    expect(await testPrisma.smsCampaign.count({ where: { createdBy: ADMIN, name: 'Second' } })).toBe(0)
  })

  it('refuses a day that already has a SENT message, and the same day twice in one campaign', async () => {
    const first = await planCampaign(ADMIN, { name: 'Sent one', messages: [{ day: day(3), body: 'a' }] })
    await testPrisma.smsCampaignMessage.update({ where: { id: first.messages[0].id }, data: { status: 'SENT', sentAt: new Date() } })
    await expect(planCampaign(ADMIN, { name: 'Again', messages: [{ day: day(3), body: 'b' }] })).rejects.toThrow(/Sent one/)
    await expect(
      planCampaign(ADMIN, { name: 'Twice', messages: [{ day: day(4), body: 'a' }, { day: day(4), body: 'b' }] }),
    ).rejects.toThrow(/twice/)
  })

  it('a day freed by a failed or missed message can be planned again', async () => {
    const f = await planCampaign(ADMIN, { name: 'Failed one', messages: [{ day: day(5), body: 'a' }] })
    await testPrisma.smsCampaignMessage.update({ where: { id: f.messages[0].id }, data: { status: 'FAILED' } })
    await expect(planCampaign(ADMIN, { name: 'Retry', messages: [{ day: day(5), body: 'b' }] })).resolves.toBeTruthy()
  })

  it('validates names, days and bodies', async () => {
    await expect(planCampaign(ADMIN, { name: ' ', messages: [{ day: day(6), body: 'a' }] })).rejects.toThrow()
    await expect(planCampaign(ADMIN, { name: 'n', messages: [] })).rejects.toThrow()
    await expect(planCampaign(ADMIN, { name: 'n', messages: [{ day: '2043-13-40', body: 'a' }] })).rejects.toThrow(/day/i)
    await expect(planCampaign(ADMIN, { name: 'n', messages: [{ day: day(6), body: ' ' }] })).rejects.toThrow(/empty/i)
  })

  it('a one-day campaign composes its single body from the English and Bengali text', async () => {
    const both = await createOneDayCampaign(ADMIN, {
      message: 'Hello', messageBn: 'হ্যালো', scheduledFor: '2043-05-10T08:00:00Z', now: new Date('2043-05-01T00:00:00Z'),
    })
    expect(both.messages[0].body).toBe('Hello\nহ্যালো')
    expect(both.name).toBe('Hello হ্যালো 2043-05-10')

    const bn = await createOneDayCampaign(ADMIN, {
      message: 'Hello', messageBn: 'হ্যালো', sendLanguage: 'BN', scheduledFor: '2043-05-11T08:00:00Z', now: new Date('2043-05-01T00:00:00Z'),
    })
    expect(bn.messages[0].body).toBe('হ্যালো')

    await expect(
      createOneDayCampaign(ADMIN, { message: 'Hello', sendLanguage: 'BN', scheduledFor: '2043-05-12T08:00:00Z', now: new Date() }),
    ).rejects.toThrow()
  })

  it('the day of a one-day campaign is the Bangladesh day of the scheduled instant', async () => {
    // 20:00Z on the 12th is already the 13th in Bangladesh
    const c = await createOneDayCampaign(ADMIN, { message: 'late', scheduledFor: '2043-05-12T20:00:00Z', now: new Date('2043-05-01T00:00:00Z') })
    expect(c.messages[0].day.toISOString().slice(0, 10)).toBe(day(13))
  })

  it('without a date it takes the next free day from tomorrow', async () => {
    const now = new Date('2043-05-19T10:00:00Z') // Bangladesh 16:00 on the 19th
    await planCampaign(ADMIN, { name: 'taken', messages: [{ day: day(20), body: 'x' }] })
    const c = await createOneDayCampaign(ADMIN, { message: 'auto', now })
    expect(c.messages[0].day.toISOString().slice(0, 10)).toBe(day(21))
  })

  it('bulk creates one one-day campaign per line, and refuses a clash before writing anything', async () => {
    const now = new Date('2043-05-01T00:00:00Z')
    const made = await createOneDayCampaignsBulk(
      ADMIN,
      [{ messageEn: 'x', messageBn: 'এক্স', scheduledDate: '2043-05-22' }, { messageEn: 'y', messageBn: 'ওয়াই' }],
      { startDate: '2043-05-23', sendLanguage: 'EN', now },
    )
    expect(made.map((c) => c.messages[0].day.toISOString().slice(0, 10))).toEqual([day(22), day(23)])
    expect(made.map((c) => c.messages[0].body)).toEqual(['x', 'y'])

    await expect(
      createOneDayCampaignsBulk(ADMIN, [{ messageEn: 'fresh', scheduledDate: '2043-05-24' }, { messageEn: 'clash', scheduledDate: '2043-05-22' }], { now }),
    ).rejects.toThrow()
    expect(await testPrisma.smsCampaignMessage.count({ where: { campaign: { createdBy: ADMIN }, body: 'fresh' } })).toBe(0)
  })

  it('lists newest first across all statuses, with derived status, and filters by status', async () => {
    const planned = await planCampaign(ADMIN, { name: 'a-planned', messages: [{ day: day(1), body: 'a' }] })
    const sent = await planCampaign(ADMIN, { name: 'b-sent', messages: [{ day: day(2), body: 'b' }, { day: day(3), body: 'c' }] })
    await testPrisma.smsCampaignMessage.update({ where: { id: sent.messages[0].id }, data: { status: 'SENT', sentAt: new Date() } })
    const cancelled = await planCampaign(ADMIN, { name: 'c-cancelled', messages: [{ day: day(4), body: 'd' }] })
    await testPrisma.smsCampaign.update({ where: { id: cancelled.id }, data: { cancelledAt: new Date() } })

    const all = await listCampaigns({ pageSize: 200 })
    const ours = all.campaigns.filter((c) => c.createdBy === ADMIN)
    expect(ours.map((c) => c.name)).toEqual(['c-cancelled', 'b-sent', 'a-planned'])
    expect(ours.map((c) => c.status)).toEqual(['cancelled', 'running', 'planned'])
    expect(all.overallTotal).toBeGreaterThanOrEqual(3)

    const running = await listCampaigns({ status: 'running', pageSize: 200 })
    expect(running.campaigns.filter((c) => c.createdBy === ADMIN).map((c) => c.id)).toEqual([sent.id])
    expect(running.campaigns.every((c) => c.status === 'running')).toBe(true)
    expect(planned.id).toBeTruthy()
  })

  it('finds the campaign holding the next planned message', async () => {
    const later = await planCampaign(ADMIN, { name: 'later', messages: [{ day: day(9), body: 'a' }] })
    const sooner = await planCampaign(ADMIN, { name: 'sooner', messages: [{ day: day(7), body: 'b' }] })
    const next = await getNextPlannedCampaignId()
    const nextRow = await testPrisma.smsCampaign.findUnique({ where: { id: next! }, include: { messages: true } })
    expect(nextRow?.messages.some((m) => m.status === 'PLANNED')).toBe(true)
    expect(later.id).not.toBe(sooner.id)
  })

  it('deletes a campaign with nothing sent, refuses one that has sent a message, and audits', async () => {
    const ok = await planCampaign(ADMIN, { name: 'del', messages: [{ day: day(1), body: 'a' }] })
    await deleteCampaign(ok.id, ADMIN)
    expect(await getCampaign(ok.id)).toBeNull()
    expect(await testPrisma.smsCampaignMessage.count({ where: { campaignId: ok.id } })).toBe(0)
    expect(await testPrisma.adminAuditLog.count({ where: { adminId: ADMIN, action: 'DELETE_SMS_CAMPAIGN', targetId: ok.id } })).toBe(1)

    const sent = await planCampaign(ADMIN, { name: 'keep', messages: [{ day: day(2), body: 'a' }, { day: day(3), body: 'b' }] })
    await testPrisma.smsCampaignMessage.update({ where: { id: sent.messages[0].id }, data: { status: 'SENT', sentAt: new Date() } })
    await expect(deleteCampaign(sent.id, ADMIN)).rejects.toThrow(/sent/i)
    expect(await getCampaign(sent.id)).not.toBeNull()
  })
})
