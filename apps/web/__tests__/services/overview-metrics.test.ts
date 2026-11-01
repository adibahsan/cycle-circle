// Asserts global counts (all users, all Pro users), so it runs in the serial group (see vitest.config.ts).
// Fixture days sit in 2036 and 2037, which no other test uses.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { testPrisma } from '../helpers/test-db'
import { getOverviewMetrics } from '@vesta/shared/server/services'
import { parseDateRange } from '@vesta/shared/utils/date-range'

const P = 'test-overview'
const u = (n: string) => `${P}-${n}`
const Y36 = { gte: new Date('2036-01-01'), lt: new Date('2037-01-01') }
const NOW = new Date('2036-03-20T06:00:00Z') // 12:00 on 20 March 2036, Bangladesh time
// 10 days: 1-10 March. Previous period: 20-29 February (2036 is a leap year).
const range = parseDateRange({ from: '2036-03-01', to: '2036-03-10' }, NOW)

async function cleanup() {
  await testPrisma.churnEvent.deleteMany({ where: { occurredAt: Y36 } })
  await testPrisma.proSnapshot.deleteMany({ where: { day: Y36 } })
  await testPrisma.proPrice.deleteMany({ where: { effectiveFrom: Y36 } })
  await testPrisma.user.deleteMany({ where: { id: { startsWith: P } } }) // cascades activity rows
}

let n = 0
async function seedUser(name: string, extra: { createdAt: string; deletedAt?: Date; suspendedAt?: Date }) {
  n += 1
  await testPrisma.user.create({
    data: {
      id: u(name),
      phone: `+88019800${String(n).padStart(5, '0')}`,
      authMethod: 'OTP',
      createdAt: new Date(extra.createdAt),
      deletedAt: extra.deletedAt,
      suspendedAt: extra.suspendedAt,
    },
  })
}
const active = (name: string, day: string) =>
  testPrisma.userActivity.create({ data: { userId: u(name), day: new Date(day) } })
const churn = (reason: 'DAILY_CHECK' | 'BDAPPS_UNSUBSCRIBE' | 'ADMIN_REVOKE' | 'ACCOUNT_DELETED', at: string) =>
  testPrisma.churnEvent.create({ data: { reason, occurredAt: new Date(at) } })
const snap = (day: string, proCount: number) => testPrisma.proSnapshot.create({ data: { day: new Date(day), proCount } })

let baseUsers = 0

beforeAll(async () => {
  await cleanup()
  baseUsers = (await getOverviewMetrics(range, NOW)).totalUsers.value!

  // Signups. 17:30Z on 10 March is 23:30 in Bangladesh (in range); 18:30Z is 11 March (out).
  await seedUser('a1', { createdAt: '2036-03-02T05:00:00Z' })
  await seedUser('a2', { createdAt: '2036-03-05T05:00:00Z' })
  await seedUser('a3', { createdAt: '2036-03-10T17:30:00Z' })
  await seedUser('a4', { createdAt: '2036-03-06T05:00:00Z', deletedAt: new Date() })
  await seedUser('b1', { createdAt: '2036-03-10T18:30:00Z' })
  await seedUser('p1', { createdAt: '2036-02-22T05:00:00Z' })
  await seedUser('s1', { createdAt: '2036-02-01T05:00:00Z', suspendedAt: new Date() })

  // Active users: 6 rows in range (suspended s1 not counted), 2 in the previous period.
  for (const [who, day] of [
    ['a1', '2036-03-01'], ['a2', '2036-03-01'], ['s1', '2036-03-01'], ['a1', '2036-03-02'],
    ['a1', '2036-03-10'], ['a2', '2036-03-10'], ['a3', '2036-03-10'],
    ['p1', '2036-02-25'], ['a1', '2036-02-25'],
    ['p1', '2036-01-15'], // recording began before both periods, so neither average drops days
  ] as const) await active(who, day)

  // Pro price: 290 a month from 1 Feb (10 a day in February, 290/31 in March), 140 a week from 6 March (20 a day).
  await testPrisma.proPrice.create({ data: { amount: 290, period: 'MONTHLY', effectiveFrom: new Date('2036-02-01') } })
  await testPrisma.proPrice.create({ data: { amount: 140, period: 'WEEKLY', effectiveFrom: new Date('2036-03-06') } })

  // Pro snapshots: 1-10 March except the 3rd; 25-29 February only; 19 Feb is the previous period's "start".
  await snap('2036-02-19', 10)
  for (const d of ['25', '26', '27', '28', '29']) await snap(`2036-02-${d}`, 4)
  for (const d of ['01', '02', '04', '05']) await snap(`2036-03-${d}`, 5)
  for (const d of ['06', '07', '08', '09', '10']) await snap(`2036-03-${d}`, 6)

  // Churn: 4 count toward the rate, 1 admin revoke does not. 18:30Z on 10 March is the 11th: out.
  await churn('DAILY_CHECK', '2036-03-04T05:00:00Z')
  await churn('DAILY_CHECK', '2036-03-04T06:00:00Z')
  await churn('BDAPPS_UNSUBSCRIBE', '2036-03-05T05:00:00Z')
  await churn('ADMIN_REVOKE', '2036-03-06T05:00:00Z')
  await churn('ACCOUNT_DELETED', '2036-03-10T17:30:00Z')
  await churn('ACCOUNT_DELETED', '2036-03-10T18:30:00Z')
  await churn('DAILY_CHECK', '2036-02-22T05:00:00Z')
  await churn('ADMIN_REVOKE', '2036-02-23T05:00:00Z')
  await churn('ADMIN_REVOKE', '2036-02-24T05:00:00Z')
})
afterAll(async () => {
  await cleanup()
  await testPrisma.$disconnect()
})

describe('getOverviewMetrics', () => {
  it('counts total users at the end of the range and new signups in it, with % change', async () => {
    const m = await getOverviewMetrics(range, NOW)
    // a1 a2 a3 p1 s1 exist by 10 March (suspended users still count; a4 was deleted, b1 signs up on the 11th); p1 s1 by 29 February.
    expect(m.totalUsers).toEqual({ value: baseUsers + 5, previous: baseUsers + 2, change: expect.any(Number) })
    // a4 signed up in the range and was deleted afterwards: still a signup.
    expect(m.newSignups).toEqual({ value: 4, previous: 1, change: 300 })
  })

  it('averages daily active users, leaving out suspended users', async () => {
    const m = await getOverviewMetrics(range, NOW)
    expect(m.activeUsers.average).toEqual({ value: 0.6, previous: 0.2, change: 200 })
    expect(m.activeUsers.latest).toEqual({ value: 3, previous: 0, change: null })
    expect(m.activeUsers.series).toHaveLength(10)
  })

  it('leaves out days before recording began, and has no comparison for a period wholly before it', async () => {
    // Recording began in 2017 at the earliest (other tests' rows); 2012 is wholly before it.
    const early = parseDateRange({ from: '2012-06-10', to: '2012-06-16' }, NOW)
    const m = await getOverviewMetrics(early, NOW)
    expect(m.activeUsers.average).toEqual({ value: null, previous: null, change: null })
    expect(m.activeUsers.latest).toEqual({ value: null, previous: null, change: null })
    expect(m.activeUsers.series).toHaveLength(7)
  })

  it('reports Pro subscribers at the end of each period', async () => {
    const m = await getOverviewMetrics(range, NOW)
    expect(m.proSubscribers).toEqual({ value: 6, previous: 4, change: 50 })
  })

  it('splits churn by reason and keeps admin revokes out of the rate', async () => {
    const { churn: c } = await getOverviewMetrics(range, NOW)
    expect(c.byReason.DAILY_CHECK.value).toBe(2)
    expect(c.byReason.BDAPPS_UNSUBSCRIBE.value).toBe(1)
    expect(c.byReason.ACCOUNT_DELETED.value).toBe(1)
    expect(c.byReason.ADMIN_REVOKE).toEqual({ value: 1, previous: 2, change: -50 })
    expect(c.churned).toEqual({ value: 4, previous: 1, change: 300 })
    // 4 churned of the 4 Pro on 29 Feb; previous period 1 of 10 on 19 Feb.
    expect(c.rate).toEqual({ value: 1, previous: 0.1, change: 900 })
  })

  it('estimates revenue from the price in effect each day, across a price change', async () => {
    const { revenue: r } = await getOverviewMetrics(range, NOW)
    // 1,2,4,5 March: 5 Pro x 290/31; 6-10 March: 6 Pro x 140/7. The 3rd has no snapshot.
    const total = (4 * 5 * 290) / 31 + 5 * 6 * 20
    expect(r.total).toBeCloseTo(total, 2)
    expect(r.unavailableDays).toBe(1)
    // Previous: 4 Pro x 290/29 on five days (25-29 Feb); five days unavailable.
    expect(r.previousTotal).toBeCloseTo(5 * 4 * 10, 2)
    // The headline is the daily average over the available days, and its change compares those: 87.455 vs 40.
    expect(r.dailyAverage.value).toBeCloseTo(total / 9, 2)
    expect(r.dailyAverage.previous).toBe(40)
    expect(r.dailyAverage.change).toBe(118.6)
    expect(r.series.find((d) => d.date === '2036-03-03')!.amount).toBeNull()
    expect(r.series.find((d) => d.date === '2036-03-06')!.amount).toBe(120)
  })

  it('shows days without a snapshot as unavailable, never zero', async () => {
    const empty = parseDateRange({ from: '2037-06-01', to: '2037-06-07' }, new Date('2037-07-01T06:00:00Z'))
    const m = await getOverviewMetrics(empty, new Date('2037-07-01T06:00:00Z'))
    expect(m.revenue.dailyAverage).toEqual({ value: null, previous: null, change: null })
    expect(m.revenue.total).toBeNull()
    expect(m.revenue.previousTotal).toBeNull()
    expect(m.revenue.unavailableDays).toBe(7)
    expect(m.revenue.series.every((d) => d.amount === null)).toBe(true)
    expect(m.proSubscribers.value).toBeNull()
    expect(m.churn.rate.value).toBeNull()
  })

  it('uses the live Pro count for today, which has no snapshot yet', async () => {
    const live = parseDateRange({ from: '2036-03-20', to: '2036-03-20' }, NOW)
    const m = await getOverviewMetrics(live, NOW)
    const pro = await testPrisma.user.count({ where: { subscriptionStatus: 'PRO', deletedAt: null } })
    expect(m.proSubscribers.value).toBe(pro)
  })
})
