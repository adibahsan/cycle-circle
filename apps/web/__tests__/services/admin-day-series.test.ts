import { describe, it, expect, afterAll } from 'vitest'
import { testPrisma } from '../helpers/test-db'
import {
  getFeedbackVolumeByDate,
  getSmsSendHistory,
  getSubscriptionTrend,
  getUserSignupTrend,
} from '@vesta/shared/server/services'
import { parseDhakaDay } from '@vesta/shared/utils/dhaka-date'

// Ticket 172 of https://github.com/adibahsan/cycle-circle/issues/167: every admin per-day
// series buckets by Bangladesh day. An event at 20:00 UTC on day D is 02:00 on D+1 in
// Bangladesh. Rows sit in a 2011 window so other rows in the DB never fall inside it.
// Ids use `ads172-`.

const P = 'ads172'
const EVENT = new Date('2011-03-10T20:00:00Z') // Bangladesh 2011-03-11 02:00
const dateFrom = parseDhakaDay('2011-03-11')!
const dateTo = parseDhakaDay('2011-03-12', true)!
// Never read by the service when dateTo is given; a far-off value proves it.
const now = new Date('2030-01-01T00:00:00Z')
const range = { dateFrom, dateTo, now }

afterAll(async () => {
  await testPrisma.smsCampaign.deleteMany({ where: { id: { startsWith: `${P}-` } } })
  await testPrisma.user.deleteMany({ where: { id: { startsWith: `${P}-` } } })
  await testPrisma.$disconnect()
})

async function makeUser(n: string, createdAt?: Date) {
  return testPrisma.user.create({
    data: {
      id: `${P}-u-${n}`,
      phone: `+88017${n.padStart(8, '0')}`,
      fullName: `ads172 ${n}`,
      authMethod: 'OTP',
      ...(createdAt ? { createdAt } : {}),
    },
  })
}

describe('admin per-day series use the Bangladesh day', () => {
  it('feedback: 20:00 UTC on D lands in D+1 and the range starts at the first requested day', async () => {
    const u = await makeUser('1')
    await testPrisma.feedback.create({
      data: { userId: u.id, category: 'GENERAL', message: 'x', createdAt: EVENT },
    })
    expect(await getFeedbackVolumeByDate(range)).toEqual([
      { date: '2011-03-11', count: 1 },
      { date: '2011-03-12', count: 0 },
    ])
  })

  it('sms: 20:00 UTC on D lands in D+1 and the range starts at the first requested day', async () => {
    const u = await makeUser('2')
    await testPrisma.smsCampaign.create({
      data: {
        id: `${P}-c-1`,
        name: 'x',
        createdBy: u.id,
        messages: { create: { day: new Date('2011-03-11T00:00:00Z'), body: 'x', status: 'SENT', sentAt: EVENT } },
      },
    })
    expect(await getSmsSendHistory(range)).toEqual([
      { date: '2011-03-11', count: 1 },
      { date: '2011-03-12', count: 0 },
    ])
  })

  it('subscription: 20:00 UTC on D lands in D+1 and the range starts at the first requested day', async () => {
    const u = await makeUser('3')
    await testPrisma.subscription.create({ data: { userId: u.id, createdAt: EVENT } })
    expect(await getSubscriptionTrend(range)).toEqual([
      { date: '2011-03-11', count: 1 },
      { date: '2011-03-12', count: 0 },
    ])
  })

  it('user: 20:00 UTC on D lands in D+1 and the range starts at the first requested day', async () => {
    await makeUser('4', EVENT)
    expect(await getUserSignupTrend(range)).toEqual([
      { date: '2011-03-11', count: 1 },
      { date: '2011-03-12', count: 0 },
    ])
  })

  it('a days window ends on the Bangladesh day of `now` (18:30 UTC is already the next day)', async () => {
    const at = new Date('2011-03-10T18:30:00Z')
    const series = await getUserSignupTrend({ days: 2, now: at })
    expect(series.map((r) => r.date)).toEqual(['2011-03-10', '2011-03-11'])
    const late = await getUserSignupTrend({ days: 2, now: new Date('2011-03-10T23:59:00Z') })
    expect(late.map((r) => r.date)).toEqual(['2011-03-10', '2011-03-11'])
  })
})
