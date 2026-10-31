import { describe, it, expect, afterAll } from 'vitest'
import { testPrisma } from '../helpers/test-db'
import {
  getUserTrend,
  getDailyActiveLoggers,
  getSymptomLoggingRate,
  getLoggingStreakDistribution,
  getDashboardStats,
} from '@vesta/shared/server/services'

// Ticket 171 (spec https://github.com/adibahsan/cycle-circle/issues/167): analytics per-day
// series, streak distribution and stats count in Bangladesh days. Fixtures sit in a 2016
// window so other rows in the DB never fall inside it. Rows use the `bd171-` id prefix.

const P = 'bd171'
const at = (iso: string) => new Date(iso)
const stored = (day: string) => new Date(`${day}T00:00:00Z`)

async function makeUser(n: string, createdAt: Date) {
  const user = await testPrisma.user.create({
    data: {
      id: `${P}-u-${n}`,
      phone: `+8801717${n.padStart(6, '0')}`,
      fullName: `bd171 ${n}`,
      authMethod: 'OTP',
      createdAt,
    },
  })
  const profile = await testPrisma.profile.create({
    data: { id: `${P}-p-${n}`, userId: user.id, name: 'p', relation: 'SELF', cycleLength: 28, periodLength: 5 },
  })
  return { user, profile }
}

async function symptom(profileId: string, day: string) {
  return testPrisma.symptomLog.create({
    data: { profileId, date: stored(day), category: 'PHYSICAL', symptomId: 'headache', value: 'x' },
  })
}

afterAll(async () => {
  await testPrisma.user.deleteMany({ where: { id: { startsWith: `${P}-` } } })
  await testPrisma.$disconnect()
})

describe('getUserTrend buckets signups by Bangladesh day', () => {
  it('puts a 02:00 Bangladesh signup (20:00Z the day before) on the Bangladesh day', async () => {
    await makeUser('1', at('2016-03-09T20:00:00Z')) // Bangladesh 2016-03-10 02:00
    const now = at('2016-03-12T10:00:00Z')
    const series = await getUserTrend({ days: 5 }, now)
    const byDate = Object.fromEntries(series.map((r) => [r.date, r.count]))
    expect(byDate['2016-03-10']).toBe(1)
    expect(byDate['2016-03-09']).toBe(0)
  })

  it('has no empty leading bucket: days=5 at 2016-03-12 starts on 2016-03-08', async () => {
    const series = await getUserTrend({ days: 5 }, at('2016-03-12T10:00:00Z'))
    expect(series.map((r) => r.date)).toEqual([
      '2016-03-08', '2016-03-09', '2016-03-10', '2016-03-11', '2016-03-12',
    ])
  })

  it('ends on the Bangladesh today at 18:30Z (00:30 Bangladesh next day)', async () => {
    const series = await getUserTrend(3, at('2016-03-12T18:30:00Z'))
    expect(series.map((r) => r.date)).toEqual(['2016-03-11', '2016-03-12', '2016-03-13'])
  })

  it('explicit Bangladesh-day range gives exactly those days', async () => {
    const series = await getUserTrend(
      { dateFrom: at('2016-03-09T18:00:00Z'), dateTo: at('2016-03-11T17:59:59.999Z') },
      at('2016-03-20T00:00:00Z'),
    )
    expect(series.map((r) => r.date)).toEqual(['2016-03-10', '2016-03-11'])
    expect(series[0].count).toBe(1)
  })
})

describe('getDailyActiveLoggers and getSymptomLoggingRate', () => {
  it('count distinct profiles per stored day with no leading bucket', async () => {
    const { profile } = await makeUser('2', at('2016-04-01T00:00:00Z'))
    await symptom(profile.id, '2016-04-10')
    await symptom(profile.id, '2016-04-11')
    const now = at('2016-04-11T23:59:00Z') // 23:59Z = Bangladesh 2016-04-12 05:59
    const series = await getDailyActiveLoggers({ days: 3 }, now)
    expect(series.map((r) => r.date)).toEqual(['2016-04-10', '2016-04-11', '2016-04-12'])
    expect(series.map((r) => r.count)).toEqual([1, 1, 0])
    const rate = await getSymptomLoggingRate({ days: 3 }, now)
    expect(rate.map((r) => r.date)).toEqual(['2016-04-10', '2016-04-11', '2016-04-12'])
    expect(rate[2].rate).toBe(0)
    expect(rate[0].rate).toBeGreaterThan(0)
  })
})

describe('getLoggingStreakDistribution counts from the Bangladesh today', () => {
  it.each([
    ['23:59Z', '2016-05-10T23:59:00Z', 'Bangladesh 05-11 05:59'],
    ['18:30Z', '2016-05-10T18:30:00Z', 'Bangladesh 05-11 00:30'],
  ])('at %s (%s) today is the Bangladesh day, 2016-05-11', async (_l, iso) => {
    const { profile } = await makeUser('3', at('2016-05-01T00:00:00Z'))
    // Logged Bangladesh today (05-11) and the two days before: active streak of 3.
    await symptom(profile.id, '2016-05-11')
    await symptom(profile.id, '2016-05-10')
    await symptom(profile.id, '2016-05-09')
    const dist = await getLoggingStreakDistribution(at(iso))
    const nonZero = Object.fromEntries(dist.filter((b) => b.bucket !== '0').map((b) => [b.bucket, b.count]))
    expect(nonZero['3-6']).toBe(1)
    await testPrisma.symptomLog.deleteMany({ where: { profileId: profile.id } })
    await testPrisma.user.deleteMany({ where: { id: `${P}-u-3` } })
  })

  it('a log on Bangladesh yesterday still keeps the streak active', async () => {
    const { profile } = await makeUser('4', at('2016-05-01T00:00:00Z'))
    await symptom(profile.id, '2016-05-10')
    await symptom(profile.id, '2016-05-09')
    const dist = await getLoggingStreakDistribution(at('2016-05-10T20:00:00Z')) // Bangladesh 05-11 02:00
    expect(Object.fromEntries(dist.map((b) => [b.bucket, b.count]))['1-2']).toBe(1)
  })
})

describe('getDashboardStats dailyLogs counts since Bangladesh midnight', () => {
  it('includes a period log created at 00:30 Bangladesh and excludes one from 23:30 the day before', async () => {
    const { profile } = await makeUser('5', at('2016-06-01T00:00:00Z'))
    const mk = (createdAt: Date, day: string) =>
      testPrisma.periodLog.create({
        data: { profileId: profile.id, startDate: stored(day), endDate: stored(day), flowIntensity: 'MEDIUM', createdAt },
      })
    await mk(at('2016-06-09T18:30:00Z'), '2016-06-01') // Bangladesh 06-10 00:30
    await mk(at('2016-06-09T17:30:00Z'), '2016-06-02') // Bangladesh 06-09 23:30
    // dailyLogs is bounded by `now` on both sides, so only our 2016 rows can fall in each window.
    // Bangladesh 06-10 09:00: today is 06-10, only the 00:30 log counts.
    expect((await getDashboardStats(at('2016-06-10T03:00:00Z'))).dailyLogs).toBe(1)
    // Bangladesh 06-11 00:00: a new day has started and nothing is logged yet.
    expect((await getDashboardStats(at('2016-06-10T18:00:00Z'))).dailyLogs).toBe(0)
    // Bangladesh 06-09 23:45: the 23:30 log is today; the 00:30 log is later than `now`, so it is not counted.
    expect((await getDashboardStats(at('2016-06-09T17:45:00Z'))).dailyLogs).toBe(1)
  })
})
