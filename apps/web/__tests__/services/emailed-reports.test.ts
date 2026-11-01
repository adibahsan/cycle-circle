// Fixture days sit in 2038, which no other test uses. Mail is mocked; the DB is real.
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { testPrisma } from '../helpers/test-db'

const mail = vi.hoisted(() => ({ sendEmail: vi.fn() }))
vi.mock('@vesta/shared/server/adapters/mail', () => mail)

const {
  parseReportRecipients,
  getReportRecipients,
  setReportRecipients,
  reportRange,
  runReport,
  REPORT_RECIPIENTS_KEY,
} = await import('@vesta/shared/server/services')

const P = 'test-reports'
const u = (n: string) => `${P}-${n}`
// Sunday 7 March 2038, 09:00 in Bangladesh
const SUNDAY = new Date('2038-03-07T03:00:00Z')
// Thursday 1 April 2038, 09:00 in Bangladesh
const FIRST = new Date('2038-04-01T03:00:00Z')

async function cleanup() {
  await testPrisma.systemSetting.deleteMany({ where: { key: { startsWith: 'reports.' } } })
  await testPrisma.user.deleteMany({ where: { id: { startsWith: P } } })
}

let n = 0
async function signup(name: string, createdAt: string) {
  n += 1
  await testPrisma.user.create({
    data: { id: u(name), phone: `+88019900${String(n).padStart(5, '0')}`, authMethod: 'OTP', createdAt: new Date(createdAt) },
  })
}

beforeAll(cleanup)
beforeEach(async () => {
  await cleanup()
  mail.sendEmail.mockReset()
  mail.sendEmail.mockResolvedValue(undefined)
})
afterAll(async () => {
  await cleanup()
  await testPrisma.$disconnect()
})

describe('report periods', () => {
  it('weekly covers the previous 7 complete Bangladesh days', () => {
    const r = reportRange('weekly', SUNDAY)
    expect([r.fromDay, r.toDay, r.days]).toEqual(['2038-02-28', '2038-03-06', 7])
  })

  it('monthly covers the previous calendar month, including February in a non-leap year', () => {
    const r = reportRange('monthly', FIRST)
    expect([r.fromDay, r.toDay, r.days]).toEqual(['2038-03-01', '2038-03-31', 31])
    const feb = reportRange('monthly', new Date('2038-03-01T03:00:00Z'))
    expect([feb.fromDay, feb.toDay, feb.days]).toEqual(['2038-02-01', '2038-02-28', 28])
  })

  it('monthly in January goes back to December of the year before', () => {
    const r = reportRange('monthly', new Date('2038-01-01T03:00:00Z'))
    expect([r.fromDay, r.toDay]).toEqual(['2037-12-01', '2037-12-31'])
  })
})

describe('report recipients', () => {
  it('splits on commas, spaces and new lines, lowercases and removes duplicates', () => {
    expect(parseReportRecipients('A@x.com, b@x.com\nB@X.com;  c@x.com')).toEqual({
      emails: ['a@x.com', 'b@x.com', 'c@x.com'],
      invalid: [],
    })
  })

  it('reports the entries that are not emails', () => {
    expect(parseReportRecipients('ok@x.com, nope, also@bad')).toMatchObject({ invalid: ['nope', 'also@bad'] })
  })

  it('refuses to save an invalid list and saves nothing', async () => {
    await expect(setReportRecipients('ok@x.com, nope')).rejects.toThrow(/nope/)
    expect(await getReportRecipients()).toEqual([])
  })

  it('saves a list and returns the previous one for the audit log', async () => {
    expect(await setReportRecipients('a@x.com')).toMatchObject({ previous: [], emails: ['a@x.com'] })
    expect(await setReportRecipients('b@x.com, c@x.com', 'admin-1')).toMatchObject({
      previous: ['a@x.com'],
      emails: ['b@x.com', 'c@x.com'],
    })
    expect(await getReportRecipients()).toEqual(['b@x.com', 'c@x.com'])
    expect((await testPrisma.systemSetting.findUnique({ where: { key: REPORT_RECIPIENTS_KEY } }))?.updatedBy).toBe('admin-1')
  })

  it('an empty list is allowed (reports stop)', async () => {
    await setReportRecipients('a@x.com')
    await setReportRecipients('')
    expect(await getReportRecipients()).toEqual([])
  })
})

describe('runReport', () => {
  it('sends nothing without recipients', async () => {
    expect(await runReport('weekly', SUNDAY)).toMatchObject({ status: 'no-recipients', sent: 0 })
    expect(mail.sendEmail).not.toHaveBeenCalled()
  })

  it('emails each recipient the period numbers with the CSV attached, typed REPORT', async () => {
    await setReportRecipients('a@x.com, b@x.com')
    await signup('s1', '2038-03-01T05:00:00Z')
    await signup('s2', '2038-03-04T05:00:00Z')
    await signup('s3', '2038-03-06T17:00:00Z') // 23:00 on 6 March in Bangladesh: inside
    await signup('out', '2038-03-06T18:30:00Z') // 00:30 on 7 March in Bangladesh: outside

    const res = await runReport('weekly', SUNDAY)
    expect(res).toMatchObject({ status: 'sent', kind: 'weekly', period: '2038-02-28_2038-03-06', sent: 2, failed: 0 })
    expect(mail.sendEmail).toHaveBeenCalledTimes(2)

    const [to, subject, html, meta] = mail.sendEmail.mock.calls[0]
    expect(to).toBe('a@x.com')
    expect(subject).toBe('Cycle Circle weekly report: 2038-02-28 to 2038-03-06')
    expect(html).toContain('New signups')
    expect(meta.type).toBe('REPORT')
    expect(meta.text).toContain('New signups: 3 (')
    expect(meta.attachments).toHaveLength(1)
    expect(meta.attachments[0].filename).toBe('overview_2038-02-28_2038-03-06.csv')
    expect(meta.attachments[0].content).toContain('New signups,3,0,')
    expect(mail.sendEmail.mock.calls[1][0]).toBe('b@x.com')
  })

  it('a repeated hit for the same period sends nothing more', async () => {
    await setReportRecipients('a@x.com')
    await runReport('weekly', SUNDAY)
    const again = await runReport('weekly', new Date(SUNDAY.getTime() + 60_000))
    expect(again).toMatchObject({ status: 'already-sent', sent: 0 })
    expect(mail.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('two hits at once send once', async () => {
    await setReportRecipients('a@x.com')
    const [a, b] = await Promise.all([runReport('weekly', SUNDAY), runReport('weekly', SUNDAY)])
    expect([a.status, b.status].sort()).toEqual(['already-sent', 'sent'])
    expect(mail.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('the next week and the monthly report are separate periods', async () => {
    await setReportRecipients('a@x.com')
    await runReport('weekly', SUNDAY)
    expect((await runReport('weekly', new Date(SUNDAY.getTime() + 7 * 86_400_000))).status).toBe('sent')
    expect((await runReport('monthly', FIRST)).status).toBe('sent')
    expect((await runReport('monthly', FIRST)).status).toBe('already-sent')
    expect(mail.sendEmail).toHaveBeenCalledTimes(3)
  })

  it('force sends again for the same period', async () => {
    await setReportRecipients('a@x.com')
    await runReport('weekly', SUNDAY)
    expect((await runReport('weekly', SUNDAY, { force: true })).status).toBe('sent')
    expect(mail.sendEmail).toHaveBeenCalledTimes(2)
  })

  it('one recipient failing does not stop the others, and the period still counts as sent', async () => {
    await setReportRecipients('bad@x.com, good@x.com')
    mail.sendEmail.mockImplementation(async (to: string) => {
      if (to === 'bad@x.com') throw new Error('smtp down')
    })
    expect(await runReport('weekly', SUNDAY)).toMatchObject({ status: 'sent', sent: 1, failed: 1 })
    expect(await runReport('weekly', SUNDAY)).toMatchObject({ status: 'already-sent' })
  })

  it('when every send fails the period is released so the next hit retries', async () => {
    await setReportRecipients('a@x.com')
    mail.sendEmail.mockRejectedValue(new Error('smtp down'))
    expect(await runReport('weekly', SUNDAY)).toMatchObject({ status: 'failed', sent: 0, failed: 1 })
    mail.sendEmail.mockResolvedValue(undefined)
    expect(await runReport('weekly', SUNDAY)).toMatchObject({ status: 'sent', sent: 1 })
  })
})
