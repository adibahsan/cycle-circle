import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { testPrisma } from '../helpers/test-db'
import {
  createCampaign,
  getCampaign,
  updateCampaignMessage,
  cancelCampaign,
  deleteCampaign,
  addCampaignMessage,
  resendCampaignMessage,
  rescheduleCampaignMessage,
} from '@vesta/shared/server/services'

const ADMIN = 'test-smscontrol-admin'
const NOW = new Date('2045-05-01T00:00:00Z')
const day = (n: number) => `2045-05-${String(n).padStart(2, '0')}`

async function cleanup() {
  await testPrisma.smsCampaign.deleteMany({ where: { createdBy: ADMIN } })
  await testPrisma.adminAuditLog.deleteMany({ where: { adminId: ADMIN } })
  await testPrisma.user.deleteMany({ where: { id: ADMIN } })
}

const audit = (targetId: string, action: string) =>
  testPrisma.adminAuditLog.findFirst({ where: { adminId: ADMIN, targetId, action } })

async function series(name: string, days: number[]) {
  return createCampaign(ADMIN, { name, messages: days.map((d) => ({ day: day(d), body: `${name} ${d}` })) }, NOW)
}

describe('controlling a running campaign (db)', () => {
  beforeAll(async () => {
    await cleanup()
    await testPrisma.user.create({
      data: { id: ADMIN, phone: '+8801940000008', fullName: 'Control Admin', authMethod: 'OTP', profileCompleted: true },
    })
  })
  afterAll(cleanup)
  beforeEach(async () => {
    await testPrisma.smsCampaign.deleteMany({ where: { createdBy: ADMIN } })
  })

  it('edits an unsent message and audits it; refuses a sent one', async () => {
    const c = await series('Edit', [2, 3])
    await updateCampaignMessage(c.messages[0].id, ADMIN, { body: 'fixed' })
    expect((await getCampaign(c.id))?.messages.find((m) => m.id === c.messages[0].id)?.body).toBe('fixed')
    expect(await audit(c.messages[0].id, 'UPDATE_SMS_MESSAGE')).toBeTruthy()

    await testPrisma.smsCampaignMessage.update({ where: { id: c.messages[1].id }, data: { status: 'SENT', sentAt: NOW } })
    await expect(updateCampaignMessage(c.messages[1].id, ADMIN, { body: 'late' })).rejects.toThrow(/sent message/)
  })

  it('cancel stops the remaining days, keeps sent ones, stamps the campaign and audits it', async () => {
    const c = await series('Cancel', [4, 5, 6])
    await testPrisma.smsCampaignMessage.update({ where: { id: c.messages[0].id }, data: { status: 'SENT', sentAt: NOW } })
    const result = await cancelCampaign(c.id, ADMIN, NOW)
    expect(result).toEqual({ cancelled: 2, sent: 1, total: 3 })
    const got = await getCampaign(c.id)
    expect(got?.status).toBe('cancelled')
    expect(got?.messages.map((m) => m.status)).toEqual(['SENT', 'CANCELLED', 'CANCELLED'])
    expect(got?.cancelledAt).toBeTruthy()
    expect(await audit(c.id, 'CANCEL_SMS_CAMPAIGN')).toBeTruthy()

    await expect(cancelCampaign(c.id, ADMIN, NOW)).rejects.toThrow(/already cancelled/)
    // Cancelled days free their Bangladesh day again.
    await expect(series('Reuse', [5])).resolves.toBeTruthy()
  })

  it('a cancelled campaign cannot be edited, moved, extended or revived through a failed day', async () => {
    const c = await series('Frozen', [7, 8])
    await testPrisma.smsCampaignMessage.update({ where: { id: c.messages[0].id }, data: { status: 'FAILED' } })
    await cancelCampaign(c.id, ADMIN, NOW)
    await expect(updateCampaignMessage(c.messages[0].id, ADMIN, { body: 'x' })).rejects.toThrow(/cancelled/)
    await expect(updateCampaignMessage(c.messages[1].id, ADMIN, { body: 'x' })).rejects.toThrow(/cancelled/)
    await expect(addCampaignMessage(c.id, ADMIN, { day: day(9), body: 'x' }, NOW)).rejects.toThrow(/cancelled/)
    await expect(resendCampaignMessage(c.messages[0].id, ADMIN, day(10), NOW)).rejects.toThrow(/cancelled/)
  })

  it('adding a clashing day is refused, a free day accepted', async () => {
    const other = await series('Holder', [12])
    const c = await series('Extend', [11])
    await expect(addCampaignMessage(c.id, ADMIN, { day: day(12), body: 'x' }, NOW)).rejects.toThrow(/"Holder"/)
    await expect(addCampaignMessage(c.id, ADMIN, { day: day(13), body: 'x' }, NOW)).resolves.toBeTruthy()
    expect(other).toBeTruthy()
  })

  it('moving a message to a past day is refused', async () => {
    const c = await series('Move', [14])
    await expect(rescheduleCampaignMessage(c.messages[0].id, ADMIN, '2045-04-01', NOW)).rejects.toThrow(/past/)
  })

  it('a failed day does not move later days; resend plans a copy on a chosen free day', async () => {
    const c = await series('Resend', [15, 16, 17])
    const [first, second] = c.messages
    await testPrisma.smsCampaignMessage.update({ where: { id: first.id }, data: { status: 'FAILED', lastError: 'boom' } })

    const resent = await resendCampaignMessage(first.id, ADMIN, day(20), NOW)
    expect(resent).toMatchObject({ body: first.body, status: 'PLANNED' })
    expect(resent.day.toISOString().slice(0, 10)).toBe(day(20))

    const got = await getCampaign(c.id)
    expect(got?.messages.map((m) => [m.day.toISOString().slice(0, 10), m.status])).toEqual([
      [day(15), 'FAILED'],
      [day(16), 'PLANNED'],
      [day(17), 'PLANNED'],
      [day(20), 'PLANNED'],
    ])
    expect(got?.messages.find((m) => m.id === second.id)?.day.toISOString().slice(0, 10)).toBe(day(16))
    expect(await audit(first.id, 'RESEND_SMS_MESSAGE')).toBeTruthy()

    // Clash and past-day rules are the planning ones.
    await expect(resendCampaignMessage(first.id, ADMIN, day(16), NOW)).rejects.toThrow(/"Resend"/)
    await expect(resendCampaignMessage(first.id, ADMIN, '2045-04-01', NOW)).rejects.toThrow(/past/)
  })

  it('resends a missed day too, but only a failed or missed one', async () => {
    const c = await series('Missed', [21, 22])
    await expect(resendCampaignMessage(c.messages[0].id, ADMIN, day(23), NOW)).rejects.toThrow(/failed or missed/)
    await testPrisma.smsCampaignMessage.update({ where: { id: c.messages[0].id }, data: { status: 'MISSED' } })
    await expect(resendCampaignMessage(c.messages[0].id, ADMIN, day(23), NOW)).resolves.toBeTruthy()
  })

  it('delete is refused once any message was sent, allowed before, and audited', async () => {
    const sent = await series('Sent', [24, 25])
    await testPrisma.smsCampaignMessage.update({ where: { id: sent.messages[0].id }, data: { status: 'SENT', sentAt: NOW } })
    await expect(deleteCampaign(sent.id, ADMIN)).rejects.toThrow(/sent/)

    const unsent = await series('Unsent', [26])
    await deleteCampaign(unsent.id, ADMIN)
    expect(await getCampaign(unsent.id)).toBeNull()
    expect(await audit(unsent.id, 'DELETE_SMS_CAMPAIGN')).toBeTruthy()
  })
})
