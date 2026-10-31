// Ticket #208: retention is measured week by week per cohort, and the heavy panels return
// the right numbers for known data (2029 window, ids prefixed `hk208-`).
import { describe, it, expect, afterAll } from 'vitest'
import { testPrisma } from '../helpers/test-db'
import { parseDateRange } from '@vesta/shared/utils/date-range'
import {
  getLoggingRetention,
  getCycleLengthDistribution,
  getSymptomsByPhase,
  getDailyActiveLoggers,
} from '@vesta/shared/server/services'

const P = 'hk208'
const stored = (day: string) => new Date(`${day}T00:00:00Z`)
const NOW = new Date('2029-07-01T06:00:00Z') // 1 July, noon in Bangladesh
const LATER = new Date('2030-01-01T06:00:00Z')

async function makeProfile(n: string, opts: { deleted?: boolean } = {}) {
  const user = await testPrisma.user.create({
    data: {
      id: `${P}-u-${n}`,
      phone: `+8801616${n.padStart(6, '0')}`,
      authMethod: 'OTP',
      deletedAt: opts.deleted ? new Date('2029-06-01T00:00:00Z') : null,
    },
  })
  return testPrisma.profile.create({
    data: { id: `${P}-p-${n}`, userId: user.id, name: 'p', relation: 'SELF', cycleLength: 28, periodLength: 5 },
  })
}
const symptom = (profileId: string, day: string, symptomId = 'headache') =>
  testPrisma.symptomLog.create({
    data: { profileId, date: stored(day), category: 'PHYSICAL', symptomId, value: 'x' },
  })
const period = (profileId: string, start: string, end: string) =>
  testPrisma.periodLog.create({
    data: { profileId, startDate: stored(start), endDate: stored(end), flowIntensity: 'MEDIUM' },
  })

afterAll(async () => {
  await testPrisma.user.deleteMany({ where: { id: { startsWith: `${P}-` } } })
  await testPrisma.$disconnect()
})

describe('getLoggingRetention', () => {
  it('measures each cohort in the week after it started; the newest cohort is not 100% by construction', async () => {
    // Seven-day blocks ending 30 June: 27 May, 3 Jun, 10 Jun, 17 Jun, 24 Jun.
    const [a, b, c, d, e, gone] = await Promise.all(['a', 'b', 'c', 'd', 'e', 'f'].map((n) => makeProfile(n, { deleted: n === 'f' })))
    // Cohort 3 June: a and b start; only a logs again in the following week.
    await symptom(a.id, '2029-06-04')
    await symptom(a.id, '2029-06-11')
    await symptom(b.id, '2029-06-04')
    // Started long before the cohort, so not in it even though it logs in the cohort week.
    await symptom(e.id, '2029-05-01')
    await symptom(e.id, '2029-06-05')
    // Cohort 17 June: d starts and logs the week after.
    await symptom(d.id, '2029-06-18')
    await symptom(d.id, '2029-06-25')
    // Cohort 24 June: c starts; the following week (from 1 July) is still in progress.
    await symptom(c.id, '2029-06-25')
    // A deleted user's profile is in no cohort.
    await symptom(gone.id, '2029-06-04')

    const range = parseDateRange({ from: '2029-05-27', to: '2029-06-30' }, NOW)
    const byWeek = Object.fromEntries((await getLoggingRetention(range, NOW)).map((w) => [w.week, w]))

    expect(byWeek['2029-06-03']).toMatchObject({ created: 2, retained: 1, rate: 50 })
    expect(byWeek['2029-06-17']).toMatchObject({ created: 1, retained: 1, rate: 100 })
    expect(byWeek['2029-06-24'].created).toBe(1)
    expect(byWeek['2029-06-24'].retained).toBeNull()
    expect(byWeek['2029-06-24'].rate).toBeNull()
  })
})

describe('heavy panels aggregate known data', () => {
  it('cycle lengths are measured gaps for live users only', async () => {
    const live = await makeProfile('g')
    const dead = await makeProfile('h', { deleted: true })
    await period(live.id, '2029-08-01', '2029-08-05')
    await period(live.id, '2029-08-29', '2029-09-02') // 28 days later
    await period(dead.id, '2029-08-01', '2029-08-05')
    await period(dead.id, '2029-08-26', '2029-08-30') // 25 days, a deleted user
    const range = parseDateRange({ from: '2029-08-01', to: '2029-09-10' }, LATER)
    expect(await getCycleLengthDistribution(range)).toEqual([{ cycleLength: 28, count: 1 }])
  })

  it('symptoms by phase uses each log\'s latest earlier period start and skips deleted users', async () => {
    const live = await makeProfile('i')
    const dead = await makeProfile('j', { deleted: true })
    await period(live.id, '2029-10-01', '2029-10-05')
    await symptom(live.id, '2029-09-20', 'before-any-period') // no period start yet: ignored
    await symptom(live.id, '2029-10-03', 'cramps') // cycle day 3
    await symptom(live.id, '2029-10-22', 'bloating') // cycle day 22
    await period(dead.id, '2029-10-01', '2029-10-05')
    await symptom(dead.id, '2029-10-03', 'cramps')
    const range = parseDateRange({ from: '2029-09-15', to: '2029-10-30' }, LATER)
    const phases = Object.fromEntries((await getSymptomsByPhase(range)).map((p) => [p.phase, p]))
    expect(phases.MENSTRUAL).toMatchObject({ total: 1, top: [{ symptomId: 'cramps', count: 1 }] })
    expect(phases.LUTEAL).toMatchObject({ total: 1, top: [{ symptomId: 'bloating', count: 1 }] })
    expect(phases.FOLLICULAR.total + phases.OVULATION.total).toBe(0)
  })

  it('daily active loggers counts distinct live profiles per day', async () => {
    const p1 = await makeProfile('k')
    const p2 = await makeProfile('l')
    const dead = await makeProfile('m', { deleted: true })
    await symptom(p1.id, '2029-11-10')
    await symptom(p1.id, '2029-11-10', 'cramps')
    await symptom(p2.id, '2029-11-10')
    await symptom(dead.id, '2029-11-10')
    await symptom(p1.id, '2029-11-11')
    const range = parseDateRange({ from: '2029-11-09', to: '2029-11-12' }, LATER)
    expect(await getDailyActiveLoggers(range, LATER)).toEqual([
      { date: '2029-11-09', count: 0 },
      { date: '2029-11-10', count: 2 },
      { date: '2029-11-11', count: 1 },
      { date: '2029-11-12', count: 0 },
    ])
  })
})
