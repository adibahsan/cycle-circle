import { describe, it, expect, afterAll } from 'vitest'
import { testPrisma } from '../helpers/test-db'
import { parseDateRange } from '@vesta/shared/utils/date-range'
import {
  getUserTrend,
  getDailyActiveLoggers,
  getSymptomLoggingRate,
  getLoggingStreakDistribution,
  getLoggingRetention,
  getSymptomsByCategory,
  getCycleLengthDistribution,
  getPredictionMaeTrend,
} from '@vesta/shared/server/services'

// Ticket #207 (spec #192): every analytics service takes the shared parsed range plus `now`.
// Fixtures sit in a 2013 window (other analytics tests own 2016); ids use `rg207-`.

const P = 'rg207'
const at = (iso: string) => new Date(iso)
const stored = (day: string) => new Date(`${day}T00:00:00Z`)

async function makeUser(n: string, createdAt: Date) {
  const user = await testPrisma.user.create({
    data: { id: `${P}-u-${n}`, phone: `+8801818${n.padStart(6, '0')}`, fullName: `rg207 ${n}`, authMethod: 'OTP', createdAt },
  })
  const profile = await testPrisma.profile.create({
    data: { id: `${P}-p-${n}`, userId: user.id, name: 'p', relation: 'SELF', cycleLength: 28, periodLength: 5 },
  })
  return { user, profile }
}

const symptom = (profileId: string, day: string) =>
  testPrisma.symptomLog.create({
    data: { profileId, date: stored(day), category: 'PHYSICAL', symptomId: 'headache', value: 'x' },
  })

afterAll(async () => {
  await testPrisma.predictionAccuracySnapshot.deleteMany({ where: { date: { gte: stored('2013-03-01'), lte: stored('2013-03-31') } } })
  await testPrisma.user.deleteMany({ where: { id: { startsWith: `${P}-` } } })
  await testPrisma.$disconnect()
})

// 2013-03-12 02:00 Bangladesh = 2013-03-11 20:00Z: the UTC day is still the 11th (#220).
const NOW_0200 = at('2013-03-11T20:00:00Z')

describe('day-series services follow the parsed range', () => {
  it('a custom range gives exactly its Bangladesh days', async () => {
    const range = parseDateRange({ from: '2013-03-08', to: '2013-03-10' }, NOW_0200)
    const series = await getUserTrend(range, NOW_0200)
    expect(series.map((r) => r.date)).toEqual(['2013-03-08', '2013-03-09', '2013-03-10'])
    expect((await getDailyActiveLoggers(range, NOW_0200)).map((r) => r.date)).toEqual(['2013-03-08', '2013-03-09', '2013-03-10'])
    expect((await getSymptomLoggingRate(range, NOW_0200)).map((r) => r.date)).toEqual(['2013-03-08', '2013-03-09', '2013-03-10'])
  })

  it('at 02:00 Bangladesh a preset includes today, and today\'s signup is counted', async () => {
    await makeUser('1', at('2013-03-11T20:30:00Z')) // Bangladesh 2013-03-12 02:30
    const range = parseDateRange({ range: '7d' }, NOW_0200)
    const series = await getUserTrend(range, NOW_0200)
    expect(series.at(-1)).toEqual({ date: '2013-03-12', count: 1 })
    expect(series).toHaveLength(7)
  })
})

describe('signup trend and deletion', () => {
  it('counts a user who signed up in the range even if deleted later', async () => {
    const { user } = await makeUser('90', at('2013-03-05T05:00:00Z'))
    await testPrisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } }) // real clock: stays clear of the purge window
    const series = await getUserTrend(parseDateRange({ from: '2013-03-05', to: '2013-03-05' }, NOW_0200), NOW_0200)
    expect(series).toEqual([{ date: '2013-03-05', count: 1 }])
  })
})

describe('panel services include today\'s logs at 02:00 Bangladesh', () => {
  const range = () => parseDateRange({ range: '7d' }, NOW_0200)

  it('symptoms by category counts a symptom dated today', async () => {
    const { profile } = await makeUser('2', at('2013-03-01T00:00:00Z'))
    await symptom(profile.id, '2013-03-12')
    const rows = await getSymptomsByCategory(range())
    expect(rows.find((r) => r.category === 'PHYSICAL')?.count).toBeGreaterThanOrEqual(1)
  })

  it('cycle-length distribution counts a period started today', async () => {
    const { profile } = await makeUser('3', at('2013-01-01T00:00:00Z'))
    await testPrisma.periodLog.createMany({
      data: ['2013-02-12', '2013-03-12'].map((d) => ({
        profileId: profile.id, startDate: stored(d), endDate: stored(d), flowIntensity: 'MEDIUM' as const,
      })),
    })
    const rows = await getCycleLengthDistribution(range())
    expect(rows.find((r) => r.cycleLength === 28)?.count).toBeGreaterThanOrEqual(1)
  })

  it('streak distribution is measured at the range end', async () => {
    const { profile } = await makeUser('4', at('2013-03-01T00:00:00Z'))
    for (const d of ['2013-03-12', '2013-03-11', '2013-03-10']) await symptom(profile.id, d)
    const dist = await getLoggingStreakDistribution(range(), NOW_0200)
    expect(Object.fromEntries(dist.map((b) => [b.bucket, b.count]))['3-6']).toBeGreaterThanOrEqual(1)

    const past = parseDateRange({ from: '2013-03-01', to: '2013-03-10' }, NOW_0200)
    const distPast = await getLoggingStreakDistribution(past, NOW_0200)
    // As of 03-10 only one log (03-10) is visible for this profile: a 1-2 streak.
    expect(Object.fromEntries(distPast.map((b) => [b.bucket, b.count]))['1-2']).toBeGreaterThanOrEqual(1)
  })

  it('logging retention builds its cohort weeks from the range end', async () => {
    const weeks = await getLoggingRetention(parseDateRange({ range: '30d' }, NOW_0200), NOW_0200)
    expect(weeks).toHaveLength(5) // ceil(30 / 7)
    expect(weeks.at(-1)!.week).toBe('2013-03-06') // last cohort week: 7 days ending 2013-03-12
  })
})

describe('getPredictionMaeTrend bounds snapshots by the range\'s Bangladesh days', () => {
  it('includes the first and last day and excludes the day before the range', async () => {
    for (const d of ['2013-03-05', '2013-03-06', '2013-03-12']) {
      await testPrisma.predictionAccuracySnapshot.create({
        data: { date: stored(d), tier: 'AVERAGE', maeDays: 1.5, sampleSize: 10, computedAt: NOW_0200 },
      })
    }
    const rows = await getPredictionMaeTrend(parseDateRange({ range: '7d' }, NOW_0200)) // 03-06 .. 03-12
    expect(rows.map((r) => r.date)).toEqual(['2013-03-06', '2013-03-12'])
  })
})
