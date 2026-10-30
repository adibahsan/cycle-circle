import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest'
import { createTestUser, cleanupTestData, testId, testPrisma } from '../helpers/test-db'
import { getEngagementSummary, setAllGoodToday } from '@vesta/shared/server/services'
import { ALL_GOOD_SYMPTOM_ID } from '@vesta/shared/utils/symptoms'

// Check-in and engagement use the Bangladesh day (UTC+6) from an injected `now`
// (https://github.com/adibahsan/cycle-circle/issues/155).
//   23:59 UTC on 03-10 is 05:59 on 03-11 in Bangladesh
//   18:30 UTC on 03-10 is 00:30 on 03-11 in Bangladesh
const SUFFIX = '9169'
const userId = testId(`user-${SUFFIX}`)
const BEFORE_MIDNIGHT = new Date('2026-03-10T17:59:00Z') // Bangladesh 03-10
const JUST_AFTER = new Date('2026-03-10T18:30:00Z') // Bangladesh 03-11
const MORNING = new Date('2026-03-10T23:59:00Z') // Bangladesh 03-11

let profileId: string
const day = (s: string) => new Date(`${s}T00:00:00Z`)

beforeAll(async () => {
  await cleanupTestData(userId)
  profileId = (await createTestUser(SUFFIX)).profile.id
})
beforeEach(async () => {
  await testPrisma.symptomLog.deleteMany({ where: { profileId } })
})
afterAll(async () => {
  await cleanupTestData(userId)
})

describe('setAllGoodToday defaults to the Bangladesh day', () => {
  it.each([JUST_AFTER, MORNING])('stores on 03-11 at %s', async (now) => {
    await setAllGoodToday(profileId, userId, now)
    const logs = await testPrisma.symptomLog.findMany({ where: { profileId, symptomId: ALL_GOOD_SYMPTOM_ID } })
    expect(logs.map((l) => l.date.toISOString())).toEqual([day('2026-03-11').toISOString()])
  })

  it('stores on 03-10 before Bangladesh midnight', async () => {
    await setAllGoodToday(profileId, userId, BEFORE_MIDNIGHT)
    const logs = await testPrisma.symptomLog.findMany({ where: { profileId, symptomId: ALL_GOOD_SYMPTOM_ID } })
    expect(logs.map((l) => l.date.toISOString())).toEqual([day('2026-03-10').toISOString()])
  })

  it('an explicit date still wins', async () => {
    await setAllGoodToday(profileId, userId, JUST_AFTER, '2026-03-05')
    const logs = await testPrisma.symptomLog.findMany({ where: { profileId } })
    expect(logs.map((l) => l.date.toISOString())).toEqual([day('2026-03-05').toISOString()])
  })
})

describe('getEngagementSummary counts from the Bangladesh day', () => {
  async function log(d: string) {
    await testPrisma.symptomLog.create({
      data: { profileId, date: day(d), symptomId: 'cramps', category: 'PHYSICAL', value: 'x' },
    })
  }

  it.each([JUST_AFTER, MORNING])('reports loggedToday and the streak for a 03-11 log at %s', async (now) => {
    await log('2026-03-10')
    await log('2026-03-11')
    const s = await getEngagementSummary(profileId, userId, now)
    expect(s?.loggedToday).toBe(true)
    expect(s?.streak).toBe(2)
    expect(s?.last30.at(-1)).toEqual({ date: '2026-03-11', logged: true })
  })

  it('does not count a 03-11 log as today before Bangladesh midnight', async () => {
    await log('2026-03-11')
    const s = await getEngagementSummary(profileId, userId, BEFORE_MIDNIGHT)
    expect(s?.loggedToday).toBe(false)
    expect(s?.last30.at(-1)?.date).toBe('2026-03-10')
  })

  it('all-good then summary agree at 00:30 Bangladesh', async () => {
    await setAllGoodToday(profileId, userId, JUST_AFTER)
    const s = await getEngagementSummary(profileId, userId, JUST_AFTER)
    expect(s?.loggedToday).toBe(true)
    expect(s?.streak).toBe(1)
  })
})
