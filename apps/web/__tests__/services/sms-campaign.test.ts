import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { testPrisma } from '../helpers/test-db'
import {
  planCampaign,
  deleteCampaign,
  deriveCampaignStatus,
  listCampaigns,
  getCampaign,
  getNextPlannedCampaignId,
  campaignNameFor,
  createCampaign,
  importCampaignCsv,
  CampaignImportError,
  addCampaignMessage,
  validateSmsBody,
  SMS_MAX_PARTS,
  SMS_MAX_CAMPAIGN_MESSAGES,
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

describe('validateSmsBody', () => {
  it('accepts English, Bengali and mixed text within the limit', () => {
    expect(validateSmsBody('Drink water today')).toBeNull()
    expect(validateSmsBody('আজ পর্যাপ্ত পানি পান করুন।')).toBeNull()
    expect(validateSmsBody('Drink water আজ পানি পান করুন')).toBeNull()
  })
  it('refuses empty text', () => expect(validateSmsBody('  ')).toMatch(/empty/i))
  it('limit depends on the encoding: Bengali hits it sooner than English', () => {
    const edgeEn = 'a'.repeat(SMS_MAX_PARTS * 153)
    const edgeBn = 'ক'.repeat(SMS_MAX_PARTS * 67)
    expect(validateSmsBody(edgeEn)).toBeNull()
    expect(validateSmsBody(edgeEn + 'a')).toMatch(/parts/)
    expect(validateSmsBody(edgeBn)).toBeNull()
    expect(validateSmsBody(edgeBn + 'ক')).toMatch(/parts/)
    expect(validateSmsBody('a'.repeat(SMS_MAX_PARTS * 67 + 1))).toBeNull()
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

  it('imports a day,text CSV as one campaign with one message per row, and audits it', async () => {
    const now = new Date('2043-05-01T00:00:00Z')
    const csv = `day,text\n${day(10)},"Hello, one"\n${day(12)},দুই\n`
    const c = await importCampaignCsv(ADMIN, { name: 'Imported', csv }, now)
    const got = await getCampaign(c.id)
    expect(got?.messages.map((m) => [m.day.toISOString().slice(0, 10), m.body])).toEqual([
      [day(10), 'Hello, one'],
      [day(12), 'দুই'],
    ])
    const log = await testPrisma.adminAuditLog.findFirst({ where: { adminId: ADMIN, targetId: c.id } })
    expect(log).toMatchObject({ action: 'IMPORT_SMS_CAMPAIGN', targetType: 'SmsCampaign' })
  })

  it('rejects the whole import with row-level errors: past day, clash naming the other campaign, repeated day, bad text', async () => {
    const now = new Date('2043-05-05T00:00:00Z')
    await planCampaign(ADMIN, { name: 'Holder', messages: [{ day: day(14), body: 'a' }] })
    const csv = ['day,text', `${day(1)},old`, `${day(14)},clash`, `${day(15)},fine`, `${day(15)},again`, `${day(16)},`].join('\n')
    const err = await importCampaignCsv(ADMIN, { name: 'Bad', csv }, now).catch((e) => e)
    expect(err).toBeInstanceOf(CampaignImportError)
    expect(err.rowErrors.map((e: { line: number }) => e.line)).toEqual([2, 3, 5, 6])
    expect(err.rowErrors[0].message).toMatch(/past/)
    expect(err.rowErrors[1].message).toContain('"Holder"')
    expect(await testPrisma.smsCampaign.count({ where: { createdBy: ADMIN, name: 'Bad' } })).toBe(0)
  })

  it('refuses an over-long name, a missing name and an oversized file', async () => {
    const now = new Date('2043-05-01T00:00:00Z')
    const csv = `day,text\n${day(10)},ok`
    await expect(importCampaignCsv(ADMIN, { name: ' ', csv }, now)).rejects.toThrow(/name/)
    await expect(importCampaignCsv(ADMIN, { name: 'x'.repeat(200), csv }, now)).rejects.toThrow(/too long/)
    await expect(importCampaignCsv(ADMIN, { name: 'Big', csv: csv + ' '.repeat(300_000) }, now)).rejects.toThrow(/too large/)
  })

  it('searches all campaigns by name or message text, case-insensitively, with correct paging', async () => {
    await planCampaign(ADMIN, { name: 'Zeta-Needle', messages: [{ day: day(1), body: 'plain' }] })
    await planCampaign(ADMIN, { name: 'Other', messages: [{ day: day(2), body: 'has a HAYSTACKWORD inside' }] })
    for (let i = 0; i < 3; i++) {
      await planCampaign(ADMIN, { name: `Filler ${i}`, messages: [{ day: day(20 + i), body: `filler ${i}` }] })
    }
    // "Zeta-Needle" is the oldest, so it is beyond the first page of size 2.
    const byName = await listCampaigns({ q: 'zeta-needle', pageSize: 2 })
    expect(byName.campaigns.map((c) => c.name)).toEqual(['Zeta-Needle'])
    expect(byName.total).toBe(1)
    expect(byName.totalPages).toBe(1)
    const byBody = await listCampaigns({ q: 'haystackword' })
    expect(byBody.campaigns.map((c) => c.name)).toEqual(['Other'])
    const filler = await listCampaigns({ q: 'Filler', pageSize: 2, page: 2 })
    expect(filler.total).toBe(3)
    expect(filler.totalPages).toBe(2)
    expect(filler.campaigns).toHaveLength(1)
    expect(filler.overallTotal).toBeGreaterThanOrEqual(5)
    const withStatus = await listCampaigns({ q: 'filler', status: 'cancelled' })
    expect(withStatus.total).toBe(0)
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

  describe('composer rules (createCampaign / addCampaignMessage)', () => {
    const NOW = new Date('2043-05-10T10:00:00Z') // Bangladesh 16:00 on the 10th

    it('plans from today on, audits it, and refuses past Bangladesh days', async () => {
      const c = await createCampaign(ADMIN, { name: 'Composer', messages: [{ day: day(10), body: 'today' }, { day: day(12), body: 'later' }] }, NOW)
      expect(c.messages).toHaveLength(2)
      await expect(
        createCampaign(ADMIN, { name: 'Old', messages: [{ day: day(9), body: 'past' }] }, NOW),
      ).rejects.toThrow(/past/)
      expect(await testPrisma.smsCampaign.count({ where: { createdBy: ADMIN, name: 'Old' } })).toBe(0)
    })

    it('uses the Bangladesh day, not the UTC day, for "today"', async () => {
      const lateUtc = new Date('2043-05-10T20:00:00Z') // already the 11th in Bangladesh
      await expect(createCampaign(ADMIN, { name: 'Edge', messages: [{ day: day(10), body: 'x' }] }, lateUtc)).rejects.toThrow(/past/)
      await expect(createCampaign(ADMIN, { name: 'Edge ok', messages: [{ day: day(11), body: 'x' }] }, lateUtc)).resolves.toBeTruthy()
    })

    it('refuses over-long text, a long name and too many messages on the server', async () => {
      await expect(
        createCampaign(ADMIN, { name: 'Long', messages: [{ day: day(14), body: 'ক'.repeat(SMS_MAX_PARTS * 67 + 1) }] }, NOW),
      ).rejects.toThrow(/parts/)
      await expect(
        createCampaign(ADMIN, { name: 'n'.repeat(81), messages: [{ day: day(14), body: 'a' }] }, NOW),
      ).rejects.toThrow(/name/i)
      const many = Array.from({ length: SMS_MAX_CAMPAIGN_MESSAGES + 1 }, (_, i) => ({ day: `2044-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`, body: 'a' }))
      await expect(createCampaign(ADMIN, { name: 'Many', messages: many }, NOW)).rejects.toThrow(/at most/)
    })

    it('names the clashing campaign, including one whose message was already sent', async () => {
      const first = await createCampaign(ADMIN, { name: 'Holder', messages: [{ day: day(15), body: 'a' }, { day: day(16), body: 'b' }] }, NOW)
      await testPrisma.smsCampaignMessage.update({ where: { id: first.messages[1].id }, data: { status: 'SENT' } })
      await expect(createCampaign(ADMIN, { name: 'Clash1', messages: [{ day: day(15), body: 'x' }] }, NOW)).rejects.toThrow(/"Holder"/)
      await expect(createCampaign(ADMIN, { name: 'Clash2', messages: [{ day: day(16), body: 'x' }] }, NOW)).rejects.toThrow(/"Holder"/)
    })

    it('adds a message on a free day, audits it, and refuses clashes, past days and cancelled campaigns', async () => {
      const c = await createCampaign(ADMIN, { name: 'Grow', messages: [{ day: day(17), body: 'a' }] }, NOW)
      const added = await addCampaignMessage(c.id, ADMIN, { day: day(19), body: 'b' }, NOW)
      expect((await getCampaign(c.id))?.messages).toHaveLength(2)
      const log = await testPrisma.adminAuditLog.findFirst({ where: { adminId: ADMIN, targetId: added.id } })
      expect(log).toMatchObject({ action: 'ADD_SMS_MESSAGE', targetType: 'SmsCampaignMessage' })

      await expect(addCampaignMessage(c.id, ADMIN, { day: day(17), body: 'c' }, NOW)).rejects.toThrow(/"Grow"/)
      await expect(addCampaignMessage(c.id, ADMIN, { day: day(9), body: 'c' }, NOW)).rejects.toThrow(/past/)
      await expect(addCampaignMessage(c.id, ADMIN, { day: day(20), body: ' ' }, NOW)).rejects.toThrow(/empty/i)
      await testPrisma.smsCampaign.update({ where: { id: c.id }, data: { cancelledAt: new Date() } })
      await expect(addCampaignMessage(c.id, ADMIN, { day: day(21), body: 'c' }, NOW)).rejects.toThrow(/cancelled/)
    })
  })
})
