import { describe, it, expect, afterAll, beforeAll, beforeEach, vi } from 'vitest'
import { createTestUser, insertPeriodLogs, cleanupTestData, testId, testPrisma } from '../helpers/test-db'
import { getDashboardData, getLoggingStatus, getCalendarData, runDailyReminders } from '@vesta/shared/server/services'

// "Today" is the Bangladesh day (UTC+6), taken from an injected `now`, never from the clock.
// Pinned moments (https://github.com/adibahsan/cycle-circle/issues/160):
//   17:59 UTC on 03-10 is 23:59 on 03-10 in Bangladesh (control, still the 10th)
//   18:30 UTC on 03-10 is 00:30 on 03-11 in Bangladesh
//   23:59 UTC on 03-10 is 05:59 on 03-11 in Bangladesh
// Between 00:00 and 06:00 Bangladesh the UTC date lags a day, which is what these tests catch.

const sendPeriodAlert = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('@vesta/shared/server/adapters/notifications', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  sendPeriodAlert,
}))

const SUFFIX = '9168'
const userId = testId(`user-${SUFFIX}`)
const BEFORE_MIDNIGHT = new Date('2026-03-10T17:59:00Z') // Bangladesh 03-10
const JUST_AFTER = new Date('2026-03-10T18:30:00Z') // Bangladesh 03-11
const MORNING = new Date('2026-03-10T23:59:00Z') // Bangladesh 03-11

let profileId: string

async function setPrediction(nextPeriodStart: string) {
  const next = new Date(`${nextPeriodStart}T00:00:00Z`)
  const data = { tier: 'AVERAGE' as const, nextPeriodStart: next, ovulationDay: next, fertileStart: next, fertileEnd: next, confidence: 0.5 }
  await testPrisma.prediction.upsert({ where: { profileId }, create: { profileId, ...data }, update: data })
}

beforeAll(async () => {
  await cleanupTestData(userId)
  const { profile } = await createTestUser(SUFFIX)
  profileId = profile.id
  await insertPeriodLogs(profileId, ['2026-03-01']) // cycle day 1 on 03-01
})

afterAll(async () => {
  await cleanupTestData(userId)
})

describe('getDashboardData counts from the Bangladesh day', () => {
  beforeEach(async () => {
    await setPrediction('2026-03-29')
  })

  it('shows the same cycle day and countdown at 00:30 and 05:59 Bangladesh', async () => {
    for (const now of [JUST_AFTER, MORNING]) {
      const d = await getDashboardData(profileId, userId, now)
      expect(d?.currentCycleDay).toBe(11)
      expect(d?.countdownToNextPeriod).toBe(18)
    }
  })

  it('is one day earlier before Bangladesh midnight', async () => {
    const d = await getDashboardData(profileId, userId, BEFORE_MIDNIGHT)
    expect(d?.currentCycleDay).toBe(10)
    expect(d?.countdownToNextPeriod).toBe(19)
  })

  it('counts from the last log when there is no prediction', async () => {
    await testPrisma.prediction.delete({ where: { profileId } })
    const d = await getDashboardData(profileId, userId, JUST_AFTER)
    expect(d?.countdownToNextPeriod).toBe(18) // 03-01 + 28 days = 03-29
  })
})

describe('late-period state and logging status', () => {
  it('is late by one day at 00:30 on the day after the predicted start, and not late before midnight', async () => {
    await setPrediction('2026-03-10')
    for (const now of [JUST_AFTER, MORNING]) {
      expect(await getLoggingStatus(profileId, userId, now)).toMatchObject({ isPeriodLate: true, daysLate: 1 })
    }
    expect(await getLoggingStatus(profileId, userId, BEFORE_MIDNIGHT)).toMatchObject({ isPeriodLate: false, daysLate: 0 })
  })

  it('reports loggedToday for a symptom log on the Bangladesh day', async () => {
    await testPrisma.symptomLog.deleteMany({ where: { profileId } })
    await testPrisma.symptomLog.create({
      data: { profileId, symptomId: 'cramps', category: 'PHYSICAL', value: 'test', date: new Date('2026-03-11T00:00:00Z') },
    })
    for (const now of [JUST_AFTER, MORNING]) {
      expect((await getLoggingStatus(profileId, userId, now))?.loggedToday).toBe(true)
    }
    expect((await getLoggingStatus(profileId, userId, BEFORE_MIDNIGHT))?.loggedToday).toBe(false)
  })
})

describe('getCalendarData projection', () => {
  it('marks the same predicted, fertile and ovulation days whatever the process timezone', async () => {
    await setPrediction('2026-03-29')
    const days = await getCalendarData(profileId, userId, '2026-03')
    expect(days).toHaveLength(31)
    const marked = (key: 'period' | 'predicted' | 'fertile' | 'ovulation') =>
      days!.filter((d) => d[key]).map((d) => d.date)
    expect(marked('period')).toEqual(['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-29', '2026-03-30', '2026-03-31'])
    expect(marked('predicted')).toEqual(['2026-03-29', '2026-03-30', '2026-03-31'])
    expect(marked('ovulation')).toEqual(['2026-03-15'])
    expect(marked('fertile')).toEqual(['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14', '2026-03-15', '2026-03-16'])
    expect(days![0].date).toBe('2026-03-01')
    expect(days![30].date).toBe('2026-03-31')
  })
})

describe('runDailyReminders counts days from the Bangladesh day', () => {
  it('sends the period alert with the right days-until at 00:30 Bangladesh', async () => {
    await testPrisma.notificationPreference.upsert({
      where: { profileId },
      create: { profileId, periodAlert: true, fertileWindow: false, loggingReminder: false },
      update: { periodAlert: true, fertileWindow: false, loggingReminder: false },
    })
    // Bangladesh today is 03-11, so a 03-13 start is 2 days away; counted from the UTC date (03-10) it would be 3 and no alert.
    await setPrediction('2026-03-13')
    sendPeriodAlert.mockClear()
    await runDailyReminders({ now: JUST_AFTER, userId, force: true })
    expect(sendPeriodAlert).toHaveBeenCalledWith(expect.objectContaining({ daysUntil: 2 }))

    // Before Bangladesh midnight it is still 03-10: 3 days away, outside the alert window.
    sendPeriodAlert.mockClear()
    await runDailyReminders({ now: BEFORE_MIDNIGHT, userId, force: true })
    expect(sendPeriodAlert).not.toHaveBeenCalled()
  })
})
