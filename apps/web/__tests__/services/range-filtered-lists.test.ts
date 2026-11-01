import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { testPrisma } from '../helpers/test-db'
import {
  listEmailLogs,
  listSubscriptions,
  planCampaign,
  generateTableCsv,
  getEmailLogStats,
} from '@vesta/shared/server/services'
import { parseDateRange } from '@vesta/shared/utils/date-range'

// The dashboard tables follow the shared range: each list takes the parsed range's from/to.
const P = 'test-range-lists'
const range = parseDateRange({ from: '2043-06-10', to: '2043-06-20' }, new Date('2043-07-01T00:00:00Z'))
const ADMIN = `${P}-admin`
const USER = `${P}-user`

async function cleanup() {
  await testPrisma.emailLog.deleteMany({ where: { to: { startsWith: P } } })
  await testPrisma.smsCampaign.deleteMany({ where: { createdBy: ADMIN } })
  await testPrisma.adminAuditLog.deleteMany({ where: { adminId: ADMIN } })
  await testPrisma.subscription.deleteMany({ where: { userId: USER } })
  await testPrisma.user.deleteMany({ where: { id: { in: [ADMIN, USER] } } })
}

beforeAll(async () => {
  await cleanup()
  await testPrisma.user.create({ data: { id: ADMIN, phone: '+8801975211001', fullName: 'A', authMethod: 'OTP', profileCompleted: true } })
  await testPrisma.user.create({ data: { id: USER, phone: '+8801975211002', fullName: 'U', authMethod: 'OTP', profileCompleted: true } })
})
afterAll(cleanup)

describe('email log list', () => {
  it('keeps mails sent inside the range, edges included, and drops the rest', async () => {
    const mk = (suffix: string, sentAt: string) =>
      testPrisma.emailLog.create({
        data: { type: 'LOGGING_REMINDER', to: `${P}-${suffix}`, subject: 's', status: 'SENT', provider: 'RESEND', sentAt: new Date(sentAt) },
      })
    await mk('before', '2043-06-09T17:59:59Z') // Bangladesh 06-09 23:59:59
    await mk('first', '2043-06-09T18:00:00Z') // Bangladesh 06-10 00:00
    await mk('last', '2043-06-20T17:59:59Z') // Bangladesh 06-20 23:59:59
    await mk('after', '2043-06-20T18:00:00Z') // Bangladesh 06-21 00:00
    const res = await listEmailLogs({ search: P, dateFrom: range.from, dateTo: range.to, pageSize: 100 })
    expect(res.items.map((i) => i.to).sort()).toEqual([`${P}-first`, `${P}-last`])
    expect(res.total).toBe(2)
  })
})

describe('email log stats', () => {
  it('count only mails sent inside the range', async () => {
    const inRange = await getEmailLogStats({ dateFrom: new Date('2043-08-10T00:00:00Z'), dateTo: new Date('2043-08-10T23:59:59Z') })
    expect(inRange.total).toBe(0)
    await testPrisma.emailLog.create({
      data: { type: 'LOGGING_REMINDER', to: `${P}-stat`, subject: 's', status: 'FAILED', provider: 'SMTP', sentAt: new Date('2043-08-10T05:00:00Z') },
    })
    const after = await getEmailLogStats({ dateFrom: new Date('2043-08-10T00:00:00Z'), dateTo: new Date('2043-08-10T23:59:59Z') })
    expect(after).toMatchObject({ total: 1, byStatus: { FAILED: 1 }, byProvider: { SMTP: 1 } })
  })
})

describe('subscription list', () => {
  it('keeps subscriptions updated inside the range', async () => {
    const sub = await testPrisma.subscription.create({ data: { userId: USER, status: 'PRO' } })
    await testPrisma.$executeRaw`UPDATE "Subscription" SET "updatedAt" = '2043-06-12T00:00:00Z' WHERE id = ${sub.id}`
    const inside = await listSubscriptions({ dateFrom: range.from, dateTo: range.to, pageSize: 500 })
    expect(inside.subscriptions.some((s) => s.id === sub.id)).toBe(true)
    const outside = await listSubscriptions({
      dateFrom: new Date('2043-06-21T00:00:00Z'),
      dateTo: new Date('2043-06-30T00:00:00Z'),
      pageSize: 500,
    })
    expect(outside.subscriptions.some((s) => s.id === sub.id)).toBe(false)
  })
})

describe('table CSV export', () => {
  const BOM = '\uFEFF'
  const logCount = () => testPrisma.adminAuditLog.count({ where: { adminId: ADMIN, action: 'EXPORT_TABLE_CSV' } })

  it('emails: only rows in the range, BOM first, formula-looking subjects escaped, audit-logged', async () => {
    await testPrisma.emailLog.create({
      data: { type: 'LOGGING_REMINDER', to: `${P}-csv-in`, subject: '=HYPERLINK("x")', status: 'SENT', provider: 'RESEND', sentAt: new Date('2043-06-15T05:00:00Z') },
    })
    await testPrisma.emailLog.create({
      data: { type: 'LOGGING_REMINDER', to: `${P}-csv-out`, subject: 'fine', status: 'SENT', provider: 'RESEND', sentAt: new Date('2043-06-25T05:00:00Z') },
    })
    const before = await logCount()
    const csv = await generateTableCsv(ADMIN, 'emails', { range, search: P })
    expect(csv.startsWith(BOM)).toBe(true)
    expect(csv).toContain(`${P}-csv-in`)
    expect(csv).not.toContain(`${P}-csv-out`)
    expect(csv).toContain(`'=HYPERLINK(""x"")`)
    expect(await logCount()).toBe(before + 1)
  })

  it('campaigns: the planning list is not cut by the range, upcoming days stay in', async () => {
    await planCampaign(ADMIN, { name: `${P} in`, messages: [{ day: '2043-06-15', body: 'a' }] })
    await planCampaign(ADMIN, { name: `${P} later`, messages: [{ day: '2043-06-21', body: 'b' }] })
    const csv = await generateTableCsv(ADMIN, 'sms-campaigns', { range, q: P })
    expect(csv.startsWith(BOM)).toBe(true)
    expect(csv).toContain(`${P} in`)
    expect(csv).toContain(`${P} later`)
  })

  it('subscriptions: status filter plus range', async () => {
    const inside = await generateTableCsv(ADMIN, 'subscriptions', { range, status: 'PRO' })
    expect(inside).toContain('+8801975211002')
    const free = await generateTableCsv(ADMIN, 'subscriptions', { range, status: 'FREE' })
    expect(free).not.toContain('+8801975211002')
  })
})
