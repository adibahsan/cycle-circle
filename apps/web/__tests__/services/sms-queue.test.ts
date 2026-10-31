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

// The delivery-report switch is one global row that sms-delivery-report.test.ts writes; pin it
// off here so these tests never see a value that file left behind.
vi.mock('@vesta/shared/server/services/sms-settings-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vesta/shared/server/services/sms-settings-service')>()),
  getSmsDeliveryReports: async () => false,
}))

const {
  planCampaign,
  rescheduleCampaignMessage,
  updateCampaignMessage,
  dispatchDueCampaignMessage,
  sendCampaignMessage,
  recoverStuckMessages,
  markMissedMessages,
  runSmsDispatch,
  setSmsSendTime,
  getSmsSendTime,
  DEFAULT_SMS_SEND_TIME,
  SMS_STUCK_SENDING_MS,
} = await import('@vesta/shared/server/services')

const ADMIN = 'test-smsqueue-admin'
// The one-message-per-day index is global, so each test file owns a block of far-future days.
const day = (n: number) => `2041-03-${String(n).padStart(2, '0')}`

async function cleanup() {
  await testPrisma.systemSetting.deleteMany({ where: { key: 'sms.dailySendTime' } })
  await testPrisma.smsCampaign.deleteMany({ where: { createdBy: ADMIN } })
  await testPrisma.adminAuditLog.deleteMany({ where: { adminId: ADMIN } })
  await testPrisma.user.deleteMany({ where: { id: ADMIN } })
}

/** A one-day campaign; returns its message. */
async function plan(d: string, body = 'Hi') {
  const c = await planCampaign(ADMIN, { name: `c ${d}`, messages: [{ day: d, body }] })
  return c.messages[0]
}
const load = (id: string) => testPrisma.smsCampaignMessage.findUniqueOrThrow({ where: { id } })

describe('SMS campaign messages: edit, send, dispatch', () => {
  beforeAll(async () => {
    await cleanup()
    await testPrisma.user.create({
      data: { id: ADMIN, phone: '+8801940000001', fullName: 'Admin', authMethod: 'OTP', profileCompleted: true },
    })
  })
  afterAll(cleanup)
  beforeEach(async () => {
    await testPrisma.systemSetting.deleteMany({ where: { key: 'sms.dailySendTime' } })
    await testPrisma.smsCampaign.deleteMany({ where: { createdBy: ADMIN } })
    bdapps.smsSend.mockReset()
    bdapps.smsSend.mockResolvedValue({ requestId: 'req-1', messageId: 'q1' })
  })

  it('updates the text of a planned message and keeps it planned on its day', async () => {
    const m = await plan(day(1), 'Old')
    const u = await updateCampaignMessage(m.id, ADMIN, { body: 'New' })
    expect(u.body).toBe('New')
    expect(u.status).toBe('PLANNED')
    expect(u.day.toISOString().slice(0, 10)).toBe(day(1))
  })

  it('rejects an empty update and leaves the row untouched', async () => {
    const m = await plan(day(1), 'Old')
    await expect(updateCampaignMessage(m.id, ADMIN, { body: '  ' })).rejects.toThrow(/empty/i)
    expect((await load(m.id)).body).toBe('Old')
  })

  it('refuses to edit or move a sent message', async () => {
    const m = await plan(day(1), 'Done')
    await testPrisma.smsCampaignMessage.update({ where: { id: m.id }, data: { status: 'SENT', sentAt: new Date() } })
    await expect(updateCampaignMessage(m.id, ADMIN, { body: 'x' })).rejects.toThrow(/sent/i)
    await expect(rescheduleCampaignMessage(m.id, ADMIN, day(2))).rejects.toThrow(/sent/i)
  })

  it('moves a planned message to a free day and resets a FAILED one', async () => {
    const m = await plan(day(1))
    const moved = await rescheduleCampaignMessage(m.id, ADMIN, day(2))
    expect(moved.status).toBe('PLANNED')
    expect(moved.day.toISOString().slice(0, 10)).toBe(day(2))

    await testPrisma.smsCampaignMessage.update({
      where: { id: m.id },
      data: { status: 'FAILED', lastError: 'boom', sendAttempts: 3 },
    })
    const r = await rescheduleCampaignMessage(m.id, ADMIN, day(3))
    expect(r.status).toBe('PLANNED')
    expect(r.lastError).toBeNull()
    expect(r.sendAttempts).toBe(0)
  })

  it('refuses to move a message onto a day another campaign uses, naming it', async () => {
    const a = await plan(day(1))
    await plan(day(2))
    await expect(rescheduleCampaignMessage(a.id, ADMIN, day(2))).rejects.toThrow(/c 2041-03-02/)
    expect(((await load(a.id)).day).toISOString().slice(0, 10)).toBe(day(1))
  })

  it('rejects an invalid day', async () => {
    const m = await plan(day(1))
    await expect(rescheduleCampaignMessage(m.id, ADMIN, 'not-a-date')).rejects.toThrow()
  })

  it('a failed dispatch makes one provider call and marks FAILED with the last error', async () => {
    bdapps.smsSend.mockRejectedValue(new Error('gateway down'))
    const m = await plan('2020-01-01')
    const res = await dispatchDueCampaignMessage(new Date('2020-01-01T09:00:00Z'))
    expect(res.dispatched).toBe(false)
    expect(bdapps.smsSend).toHaveBeenCalledTimes(1)
    const row = await load(m.id)
    expect(row.status).toBe('FAILED')
    expect(row.sendAttempts).toBe(1)
    expect(row.lastError).toContain('gateway down')
    // FAILED rows are not picked up again, so the queue is not held across days
    bdapps.smsSend.mockClear()
    await dispatchDueCampaignMessage(new Date('2020-01-02T09:00:00Z'))
    expect(bdapps.smsSend).not.toHaveBeenCalled()
  })

  it('a failed manual send is marked FAILED with lastError and rethrows, after one provider call', async () => {
    bdapps.smsSend.mockRejectedValue(new Error('gateway down'))
    const m = await plan(day(1))
    await expect(sendCampaignMessage(m.id, ADMIN, new Date())).rejects.toThrow('gateway down')
    expect(bdapps.smsSend).toHaveBeenCalledTimes(1)
    const row = await load(m.id)
    expect(row.status).toBe('FAILED')
    expect(row.lastError).toContain('gateway down')
  })

  it('two concurrent manual sends make exactly one provider call', async () => {
    bdapps.smsSend.mockImplementation(() => new Promise((r) => setTimeout(() => r({ requestId: 'r', messageId: 'x' }), 50)))
    const m = await plan(day(1))
    const results = await Promise.allSettled([
      sendCampaignMessage(m.id, ADMIN, new Date()),
      sendCampaignMessage(m.id, ADMIN, new Date()),
    ])
    expect(bdapps.smsSend).toHaveBeenCalledTimes(1)
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const loser = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(String(loser.reason)).toMatch(/already being sent/)
    expect((await load(m.id)).status).toBe('SENT')
  })

  it('a manual send racing the cron makes exactly one provider call', async () => {
    bdapps.smsSend.mockImplementation(() => new Promise((r) => setTimeout(() => r({ requestId: 'r', messageId: 'x' }), 50)))
    const m = await plan('2020-01-01')
    await Promise.allSettled([
      sendCampaignMessage(m.id, ADMIN, new Date('2020-01-01T09:00:00Z')),
      dispatchDueCampaignMessage(new Date('2020-01-01T09:00:00Z')),
    ])
    expect(bdapps.smsSend).toHaveBeenCalledTimes(1)
  })

  it('a DB error after a successful send never marks the message FAILED', async () => {
    const m = await plan(day(1))
    const { prisma } = await import('@vesta/shared')
    const spy = vi.spyOn(prisma.smsCampaignMessage, 'update').mockRejectedValueOnce(new Error('db down'))
    try {
      await expect(sendCampaignMessage(m.id, ADMIN, new Date())).rejects.toThrow(/was sent/)
    } finally {
      spy.mockRestore()
    }
    expect(bdapps.smsSend).toHaveBeenCalledTimes(1)
    const row = await load(m.id)
    expect(row.status).toBe('SENDING')
    expect(row.status).not.toBe('FAILED')
  })

  it('recovers a message stuck in SENDING as "outcome unknown", and the admin can move it', async () => {
    const stuck = await plan(day(1), 'stuck')
    const fresh = await plan(day(2), 'fresh')
    const now = new Date()
    await testPrisma.smsCampaignMessage.update({
      where: { id: stuck.id },
      data: { status: 'SENDING', updatedAt: new Date(now.getTime() - SMS_STUCK_SENDING_MS - 60_000) },
    })
    await testPrisma.smsCampaignMessage.update({ where: { id: fresh.id }, data: { status: 'SENDING' } })

    const res = await recoverStuckMessages(now)
    expect(res.recovered).toBeGreaterThanOrEqual(1)
    const row = await load(stuck.id)
    expect(row.status).toBe('FAILED')
    expect(row.lastError).toMatch(/outcome unknown/i)
    expect((await load(fresh.id)).status).toBe('SENDING')

    const again = await rescheduleCampaignMessage(stuck.id, ADMIN, day(3))
    expect(again.status).toBe('PLANNED')
    expect(again.lastError).toBeNull()
  })

  it('a successful dispatch marks SENT, clears the error and keeps both BDApps ids', async () => {
    const m = await plan('2020-01-01')
    await testPrisma.smsCampaignMessage.update({ where: { id: m.id }, data: { lastError: 'old', sendAttempts: 1 } })
    const res = await dispatchDueCampaignMessage(new Date('2020-01-01T09:00:00Z'))
    expect(res).toMatchObject({ dispatched: true, messageId: m.id, campaignId: m.campaignId })
    const row = await load(m.id)
    expect(row).toMatchObject({
      status: 'SENT', lastError: null, providerRequestId: 'req-1', providerMessageId: 'q1', sendAttempts: 2,
    })
    expect(row.sentAt?.toISOString()).toBe('2020-01-01T09:00:00.000Z')
    expect(bdapps.smsSend).toHaveBeenCalledWith('Hi', ['tel:all'], 0)
  })

  it('dispatch sends only today\'s message, never a future day or a cancelled campaign', async () => {
    const future = await plan(day(5), 'future')
    const cancelled = await plan('2020-01-01', 'cancelled')
    await testPrisma.smsCampaign.update({ where: { id: cancelled.campaignId }, data: { cancelledAt: new Date() } })
    const due = await plan('2020-01-02', 'due')

    const res = await dispatchDueCampaignMessage(new Date('2020-01-02T12:00:00Z'))
    expect(res).toMatchObject({ dispatched: true, messageId: due.id })
    expect(bdapps.smsSend).toHaveBeenCalledTimes(1)
    expect(bdapps.smsSend).toHaveBeenCalledWith('due', ['tel:all'], 0)
    expect((await load(future.id)).status).toBe('PLANNED')
    expect((await load(cancelled.id)).status).toBe('PLANNED')
  })

  describe('daily send time', () => {
    // 14:00 Bangladesh = 08:00 UTC
    const before = new Date('2020-01-02T07:59:00Z')
    const after = new Date('2020-01-02T08:00:00Z')

    it('defaults to 14:00 Bangladesh time when never set', async () => {
      expect(await getSmsSendTime()).toBe(DEFAULT_SMS_SEND_TIME)
      expect(DEFAULT_SMS_SEND_TIME).toBe('14:00')
    })

    it('rejects a malformed send time and keeps the old one', async () => {
      await setSmsSendTime('09:30', ADMIN)
      for (const bad of ['24:00', '9:30', '12:60', '', 'noon']) {
        await expect(setSmsSendTime(bad, ADMIN)).rejects.toThrow(/HH:MM/)
      }
      expect(await getSmsSendTime()).toBe('09:30')
    })

    it('sends nothing before the send time, then sends once it has passed', async () => {
      const m = await plan('2020-01-02', 'today')
      expect(await dispatchDueCampaignMessage(before)).toMatchObject({ dispatched: false })
      expect(bdapps.smsSend).not.toHaveBeenCalled()
      expect((await load(m.id)).status).toBe('PLANNED')

      expect(await dispatchDueCampaignMessage(after)).toMatchObject({ dispatched: true, messageId: m.id })
      expect(bdapps.smsSend).toHaveBeenCalledTimes(1)
      expect((await load(m.id)).status).toBe('SENT')
    })

    it('follows a changed send time (Bangladesh time)', async () => {
      await setSmsSendTime('09:30', ADMIN) // 03:30 UTC
      const m = await plan('2020-01-02', 'today')
      await dispatchDueCampaignMessage(new Date('2020-01-02T03:29:00Z'))
      expect(bdapps.smsSend).not.toHaveBeenCalled()
      await dispatchDueCampaignMessage(new Date('2020-01-02T03:30:00Z'))
      expect(bdapps.smsSend).toHaveBeenCalledTimes(1)
      expect((await load(m.id)).status).toBe('SENT')
    })

    it('is idempotent when the cron runs many times a day', async () => {
      const m = await plan('2020-01-02', 'today')
      for (let i = 0; i < 4; i++) {
        await dispatchDueCampaignMessage(new Date(after.getTime() + i * 15 * 60_000))
      }
      await Promise.all([dispatchDueCampaignMessage(after), dispatchDueCampaignMessage(after)])
      expect(bdapps.smsSend).toHaveBeenCalledTimes(1)
      expect((await load(m.id)).sendAttempts).toBe(1)
    })

    it('marks past unsent days MISSED and never sends them late', async () => {
      const past = await plan('2020-01-01', 'yesterday')
      const today = await plan('2020-01-02', 'today')
      const res = await dispatchDueCampaignMessage(after)
      expect(res).toMatchObject({ dispatched: true, messageId: today.id })
      expect(bdapps.smsSend).toHaveBeenCalledTimes(1)
      expect(bdapps.smsSend).toHaveBeenCalledWith('today', ['tel:all'], 0)
      expect((await load(past.id)).status).toBe('MISSED')
    })

    it('marks a missed day even before today\'s send time, and leaves cancelled campaigns alone', async () => {
      const past = await plan('2020-01-01', 'yesterday')
      const cancelled = await plan('2019-12-31', 'cancelled')
      await testPrisma.smsCampaign.update({ where: { id: cancelled.campaignId }, data: { cancelledAt: new Date() } })
      expect(await markMissedMessages(before)).toMatchObject({ missed: expect.any(Number) })
      await dispatchDueCampaignMessage(before)
      expect((await load(past.id)).status).toBe('MISSED')
      expect((await load(cancelled.id)).status).toBe('PLANNED')
      expect(bdapps.smsSend).not.toHaveBeenCalled()
    })

    it('the cron step reports under smsBroadcast and smsRecovery and does not throw', async () => {
      const m = await plan('2020-01-02', 'today')
      const res = await runSmsDispatch(after)
      expect(res.smsBroadcast).toMatchObject({ dispatched: true, messageId: m.id })
      expect(res.smsRecovery).toMatchObject({ recovered: expect.any(Number) })
    })
  })

  it('a send writes an audit row against the campaign message', async () => {
    const m = await plan(day(1))
    await sendCampaignMessage(m.id, ADMIN, new Date())
    const log = await testPrisma.adminAuditLog.findFirst({ where: { adminId: ADMIN, targetId: m.id } })
    expect(log).toMatchObject({ action: 'SEND_SMS_BROADCAST', targetType: 'SmsCampaignMessage' })
  })
})
