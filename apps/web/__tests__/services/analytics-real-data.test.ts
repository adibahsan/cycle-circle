import { describe, it, expect, afterAll } from 'vitest'
import { testPrisma } from '../helpers/test-db'
import {
  measuredCycleGaps,
  getCycleLengthDistribution,
  getSymptomsByPhase,
  getUserRetention,
} from '@vesta/shared/server/services'

// Ticket #91: analytics on real data. Hand-built fixtures in a 2019 window so
// other rows in the DB never fall inside it. Rows use the `an91-` id prefix.

const DAY = 86_400_000
const d = (s: string) => new Date(`${s}T00:00:00Z`)
const P = 'an91'

async function makeUser(n: string, createdAt: Date, cycleLength = 28) {
  const user = await testPrisma.user.create({
    data: {
      id: `${P}-u-${n}`,
      phone: `+88013${n.padStart(8, '0')}`,
      fullName: `an91 ${n}`,
      authMethod: 'OTP',
      createdAt,
    },
  })
  const profile = await testPrisma.profile.create({
    data: { id: `${P}-p-${n}`, userId: user.id, name: 'p', relation: 'SELF', cycleLength, periodLength: 5 },
  })
  return { user, profile }
}

async function period(profileId: string, start: string, createdAt?: Date) {
  return testPrisma.periodLog.create({
    data: {
      profileId,
      startDate: d(start),
      endDate: new Date(d(start).getTime() + 4 * DAY),
      flowIntensity: 'MEDIUM',
      ...(createdAt ? { createdAt } : {}),
    },
  })
}

async function symptom(profileId: string, date: string, symptomId: string, createdAt?: Date) {
  return testPrisma.symptomLog.create({
    data: { profileId, date: d(date), category: 'PHYSICAL', symptomId, value: 'x', ...(createdAt ? { createdAt } : {}) },
  })
}

afterAll(async () => {
  await testPrisma.user.deleteMany({ where: { id: { startsWith: `${P}-` } } })
  await testPrisma.$disconnect()
})

describe('measuredCycleGaps', () => {
  it('measures gaps between consecutive starts and drops implausible ones', () => {
    const t = d('2019-01-01').getTime()
    const starts = [t, t + 28 * DAY, t + 28 * DAY + 5 * DAY, t + 28 * DAY + 5 * DAY + 200 * DAY, t + 233 * DAY + 30 * DAY]
    expect(measuredCycleGaps(starts).map((g) => g.days)).toEqual([28, 30])
  })
  it('returns nothing for a single start', () => {
    expect(measuredCycleGaps([1])).toEqual([])
  })
})

describe('getCycleLengthDistribution', () => {
  it('uses measured gaps, not the typed profile cycleLength', async () => {
    // typed length 99; measured 28, 28, 30; the 100-day gap is excluded
    const { profile } = await makeUser('1', d('2019-01-01'), 99)
    for (const s of ['2019-01-01', '2019-01-29', '2019-02-26', '2019-03-28', '2019-07-06']) {
      await period(profile.id, s)
    }
    const dist = await getCycleLengthDistribution({ from: d('2019-01-01'), to: d('2019-12-31') })
    expect(dist).toEqual([
      { cycleLength: 28, count: 2 },
      { cycleLength: 30, count: 1 },
    ])
  })

  it('respects the from/to window on the later period start', async () => {
    const dist = await getCycleLengthDistribution({ from: d('2019-03-01'), to: d('2019-12-31') })
    expect(dist).toEqual([{ cycleLength: 30, count: 1 }])
  })
})

describe('getSymptomsByPhase', () => {
  it('returns top-N symptom types per phase, excluding all_good, with no identifiers', async () => {
    const { profile } = await makeUser('2', d('2018-01-01'))
    await period(profile.id, '2018-03-01')
    // cycle day 1-5 = menstrual (Mar 1-5): cramps x2, fatigue x1, all_good x1
    await symptom(profile.id, '2018-03-01', 'cramps')
    await symptom(profile.id, '2018-03-02', 'cramps')
    await symptom(profile.id, '2018-03-03', 'fatigue')
    await symptom(profile.id, '2018-03-04', 'all_good')
    // cycle day 6 = follicular
    await symptom(profile.id, '2018-03-06', 'bloating')

    const res = await getSymptomsByPhase({ from: d('2018-03-01'), to: d('2018-03-31') }, { topN: 1 })
    const by = Object.fromEntries(res.map((r) => [r.phase, r]))
    expect(by.MENSTRUAL.total).toBe(3)
    expect(by.MENSTRUAL.top).toEqual([{ symptomId: 'cramps', count: 2 }])
    expect(by.FOLLICULAR.top).toEqual([{ symptomId: 'bloating', count: 1 }])
    expect(by.LUTEAL.top).toEqual([])
    expect(JSON.stringify(res)).not.toContain(P)
  })
})

describe('getUserRetention', () => {
  it('computes share of each signup cohort active in week 0..N, aggregate only', async () => {
    const signup = d('2017-06-01')
    const a = await makeUser('3', signup)
    const b = await makeUser('4', new Date(signup.getTime() + DAY))
    const c = await makeUser('5', new Date(signup.getTime() + 2 * DAY))
    // a: active week 0 and 1; b: week 0 only; c: never active
    await symptom(a.profile.id, '2017-06-02', 'cramps', new Date(signup.getTime() + 1 * DAY))
    await period(a.profile.id, '2017-06-09', new Date(signup.getTime() + 8 * DAY))
    await symptom(b.profile.id, '2017-06-02', 'cramps', new Date(signup.getTime() + 2 * DAY))

    const res = await getUserRetention({ from: signup, to: new Date(signup.getTime() + 6 * DAY) }, { maxWeeks: 3 })
    expect(res).toHaveLength(1)
    expect(res[0].cohortWeek).toBe('2017-06-01')
    expect(res[0].size).toBe(3)
    expect(res[0].weeks).toEqual([
      { week: 0, active: 2, rate: 67 },
      { week: 1, active: 1, rate: 33 },
      { week: 2, active: 0, rate: 0 },
    ])
    expect(JSON.stringify(res)).not.toContain(P)
  })

  it('omits weeks that have not fully elapsed', async () => {
    const signup = d('2017-06-01')
    const res = await getUserRetention(
      { from: signup, to: new Date(signup.getTime() + 6 * DAY) },
      { maxWeeks: 8, now: new Date(signup.getTime() + 15 * DAY) },
    )
    expect(res[0].weeks.map((w) => w.week)).toEqual([0])
  })
})
