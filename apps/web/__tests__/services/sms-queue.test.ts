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

const {
  createBroadcast,
  updateBroadcast,
  rescheduleBroadcast,
  dispatchScheduledBroadcast,
  listBroadcasts,
  getNextScheduledBroadcastId,
  SMS_MAX_SEND_ATTEMPTS,
} = await import('@vesta/shared/server/services')

const ADMIN = 'test-smsqueue-admin'

async function cleanup() {
  await testPrisma.smsBroadcast.deleteMany({ where: { createdBy: ADMIN } })
  await testPrisma.adminAuditLog.deleteMany({ where: { adminId: ADMIN } })
  await testPrisma.user.deleteMany({ where: { id: ADMIN } })
}

describe('SMS queue management', () => {
  beforeAll(async () => {
    await cleanup()
    await testPrisma.user.create({
      data: { id: ADMIN, phone: '+8801930000001', fullName: 'Admin', authMethod: 'OTP', profileCompleted: true },
    })
  })
  afterAll(cleanup)
  beforeEach(async () => {
    await testPrisma.smsBroadcast.deleteMany({ where: { createdBy: ADMIN } })
    bdapps.smsSend.mockReset()
    bdapps.smsSend.mockResolvedValue({ messageId: 'q1' })
  })

  it('updates text and language of a scheduled broadcast and keeps it scheduled', async () => {
    const b = await createBroadcast(ADMIN, 'Old', 'পুরনো', '2027-05-01T08:00:00Z')
    const u = await updateBroadcast(b.id, ADMIN, { message: 'New', messageBn: 'নতুন', sendLanguage: 'EN' })
    expect(u.message).toBe('New')
    expect(u.sendLanguage).toBe('EN')
    expect(u.status).toBe('SCHEDULED')
    expect(u.scheduledFor?.toISOString()).toBe('2027-05-01T08:00:00.000Z')
  })

  it('rejects an update with invalid language/text and leaves the row untouched', async () => {
    const b = await createBroadcast(ADMIN, 'Old', undefined, '2027-05-01T08:00:00Z', 'EN')
    await expect(updateBroadcast(b.id, ADMIN, { sendLanguage: 'BN' })).rejects.toThrow()
    const row = await testPrisma.smsBroadcast.findUnique({ where: { id: b.id } })
    expect(row?.sendLanguage).toBe('EN')
  })

  it('refuses to edit or reschedule a sent broadcast', async () => {
    const b = await createBroadcast(ADMIN, 'Done')
    await testPrisma.smsBroadcast.update({ where: { id: b.id }, data: { status: 'SENT', sentAt: new Date() } })
    await expect(updateBroadcast(b.id, ADMIN, { message: 'x' })).rejects.toThrow(/sent/i)
    await expect(rescheduleBroadcast(b.id, ADMIN, '2027-06-01T08:00:00Z')).rejects.toThrow(/sent/i)
  })

  it('reschedules a draft into the queue and resets a FAILED one', async () => {
    const d = await createBroadcast(ADMIN, 'Draft')
    expect(d.status).toBe('DRAFT')
    const s = await rescheduleBroadcast(d.id, ADMIN, '2027-06-01T08:00:00Z')
    expect(s.status).toBe('SCHEDULED')
    expect(s.scheduledFor?.toISOString()).toBe('2027-06-01T08:00:00.000Z')

    await testPrisma.smsBroadcast.update({
      where: { id: d.id },
      data: { status: 'FAILED', lastError: 'boom', sendAttempts: 3 },
    })
    const r = await rescheduleBroadcast(d.id, ADMIN, '2027-06-02T08:00:00Z')
    expect(r.status).toBe('SCHEDULED')
    expect(r.lastError).toBeNull()
    expect(r.sendAttempts).toBe(0)
  })

  it('rejects an invalid reschedule date', async () => {
    const b = await createBroadcast(ADMIN, 'x', undefined, '2027-05-01T08:00:00Z')
    await expect(rescheduleBroadcast(b.id, ADMIN, 'not-a-date')).rejects.toThrow()
  })

  it('retries a failing dispatch, then marks FAILED with the last error', async () => {
    bdapps.smsSend.mockRejectedValue(new Error('gateway down'))
    const b = await createBroadcast(ADMIN, 'Hi', undefined, '2020-01-01T08:00:00Z', 'EN')
    for (let i = 1; i < SMS_MAX_SEND_ATTEMPTS; i++) {
      const res = await dispatchScheduledBroadcast(new Date('2020-01-02'))
      expect(res.dispatched).toBe(false)
      const row = await testPrisma.smsBroadcast.findUnique({ where: { id: b.id } })
      expect(row?.status).toBe('SCHEDULED')
      expect(row?.sendAttempts).toBe(i)
    }
    await dispatchScheduledBroadcast(new Date('2020-01-02'))
    const row = await testPrisma.smsBroadcast.findUnique({ where: { id: b.id } })
    expect(row?.status).toBe('FAILED')
    expect(row?.sendAttempts).toBe(SMS_MAX_SEND_ATTEMPTS)
    expect(row?.lastError).toContain('gateway down')
    // FAILED rows are not picked up again
    bdapps.smsSend.mockClear()
    await dispatchScheduledBroadcast(new Date('2020-01-03'))
    expect(bdapps.smsSend).not.toHaveBeenCalled()
  })

  it('a successful send clears the error and marks SENT', async () => {
    const b = await createBroadcast(ADMIN, 'Hi', undefined, '2020-01-01T08:00:00Z', 'EN')
    await testPrisma.smsBroadcast.update({ where: { id: b.id }, data: { lastError: 'old', sendAttempts: 1 } })
    await dispatchScheduledBroadcast(new Date('2020-01-02'))
    const row = await testPrisma.smsBroadcast.findUnique({ where: { id: b.id } })
    expect(row?.status).toBe('SENT')
    expect(row?.lastError).toBeNull()
  })

  it('queue view lists unsent broadcasts by date ascending, nulls last, and finds the next send', async () => {
    const late = await createBroadcast(ADMIN, 'late', undefined, '2027-09-01T08:00:00Z')
    const early = await createBroadcast(ADMIN, 'early', undefined, '2027-07-01T08:00:00Z')
    const draft = await createBroadcast(ADMIN, 'draft')
    const sent = await createBroadcast(ADMIN, 'sent', undefined, '2027-06-01T08:00:00Z')
    await testPrisma.smsBroadcast.update({ where: { id: sent.id }, data: { status: 'SENT', sentAt: new Date() } })

    const res = await listBroadcasts({ status: 'queue', pageSize: 100 })
    const ours = res.broadcasts.filter((x) => x.createdBy === ADMIN).map((x) => x.id)
    expect(ours).toEqual([early.id, late.id, draft.id])
    expect(res.overallTotal).toBeGreaterThanOrEqual(4)

    const next = await getNextScheduledBroadcastId()
    const nextRow = await testPrisma.smsBroadcast.findUnique({ where: { id: next! } })
    expect(nextRow?.status).toBe('SCHEDULED')
  })
})
