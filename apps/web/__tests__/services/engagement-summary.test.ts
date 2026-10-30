import { describe, it, expect, afterAll, beforeEach } from 'vitest'
import {
  testPrisma,
  testId,
  createTestUser,
  insertPeriodLogs,
  cleanupTestData,
} from '../helpers/test-db'
import {
  getEngagementSummary,
  setAllGoodToday,
  toggleSymptomLog,
} from '@vesta/shared/server/services'
import { getSymptomFrequency } from '@vesta/shared/server/services'
import { bangladeshToday } from '@vesta/shared/utils/dhaka-date'
import { ALL_GOOD_SYMPTOM_ID } from '@vesta/shared/utils/symptoms'

// All tests use process.env.TZ = 'UTC' (set by setup-env.ts)
// Dates stored as new Date('YYYY-MM-DD') = midnight UTC

// "Today" is the Bangladesh day, matching what the services take from `new Date()`.
function utcDateStr(offsetDays = 0): string {
  const d = new Date(`${bangladeshToday()}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

async function insertSymptomLog(
  profileId: string,
  dateStr: string,
  symptomId = 'cramps',
  category: 'PHYSICAL' | 'MOOD' | 'DISCHARGE' | 'LIFESTYLE' = 'PHYSICAL',
) {
  return testPrisma.symptomLog.create({
    data: {
      profileId,
      date: new Date(dateStr),
      symptomId,
      category,
      value: 'test',
    },
  })
}

// ── Test suite 1: streak includes today when logged ───────────────────────────

describe('getEngagementSummary — today logged → streak includes today', () => {
  const suffix = 'eng1'
  let profileId: string
  let userId: string

  afterAll(async () => {
    await cleanupTestData(userId)
  })

  it('setup user and profile', async () => {
    const result = await createTestUser(suffix)
    userId = result.user.id
    profileId = result.profile.id
  })

  it('with a symptom log today, streak is at least 1 and streakAtRisk is false', async () => {
    const today = utcDateStr(0)
    await insertSymptomLog(profileId, today)

    const summary = await getEngagementSummary(profileId, userId, new Date())
    expect(summary).not.toBeNull()
    expect(summary!.loggedToday).toBe(true)
    expect(summary!.streak).toBeGreaterThanOrEqual(1)
    expect(summary!.streakAtRisk).toBe(false)
  })

  it('streak counts consecutive days including today', async () => {
    const yesterday = utcDateStr(-1)
    await insertSymptomLog(profileId, yesterday, 'headache')

    const summary = await getEngagementSummary(profileId, userId, new Date())
    expect(summary).not.toBeNull()
    expect(summary!.streak).toBeGreaterThanOrEqual(2)
    expect(summary!.streakAtRisk).toBe(false)
  })
})

// ── Test suite 2: gap yesterday → streak/atRisk correct ──────────────────────

describe('getEngagementSummary — today NOT logged, yesterday logged → streakAtRisk', () => {
  const suffix = 'eng2'
  let profileId: string
  let userId: string

  afterAll(async () => {
    await cleanupTestData(userId)
  })

  it('setup', async () => {
    const result = await createTestUser(suffix)
    userId = result.user.id
    profileId = result.profile.id
  })

  it('only yesterday logged → streak=1, streakAtRisk=true, loggedToday=false', async () => {
    const yesterday = utcDateStr(-1)
    await insertSymptomLog(profileId, yesterday)

    const summary = await getEngagementSummary(profileId, userId, new Date())
    expect(summary).not.toBeNull()
    expect(summary!.loggedToday).toBe(false)
    expect(summary!.streak).toBe(1)
    expect(summary!.streakAtRisk).toBe(true)
  })

  it('2 consecutive days ending yesterday → streak=2, streakAtRisk=true', async () => {
    const twoDaysAgo = utcDateStr(-2)
    await insertSymptomLog(profileId, twoDaysAgo, 'fatigue')

    const summary = await getEngagementSummary(profileId, userId, new Date())
    expect(summary).not.toBeNull()
    expect(summary!.streak).toBe(2)
    expect(summary!.streakAtRisk).toBe(true)
  })

  it('neither today nor yesterday logged → streak=0, streakAtRisk=false', async () => {
    // Create a fresh profile for this sub-test
    const sub = await createTestUser(`${suffix}b`)
    const summary = await getEngagementSummary(sub.profile.id, sub.user.id, new Date())
    expect(summary).not.toBeNull()
    expect(summary!.streak).toBe(0)
    expect(summary!.streakAtRisk).toBe(false)
    // cleanup inline
    await cleanupTestData(sub.user.id)
  })
})

// ── Test suite 3: "all good" sentinel counts as a logged day ─────────────────

describe('getEngagementSummary — "all good" sentinel counts as logged', () => {
  const suffix = 'eng3'
  let profileId: string
  let userId: string

  afterAll(async () => {
    await cleanupTestData(userId)
  })

  it('setup', async () => {
    const result = await createTestUser(suffix)
    userId = result.user.id
    profileId = result.profile.id
  })

  it('setAllGoodToday makes loggedToday=true and streak≥1', async () => {
    await setAllGoodToday(profileId, userId, new Date())

    const summary = await getEngagementSummary(profileId, userId, new Date())
    expect(summary).not.toBeNull()
    expect(summary!.loggedToday).toBe(true)
    expect(summary!.streak).toBeGreaterThanOrEqual(1)
    expect(summary!.streakAtRisk).toBe(false)
  })

  it('sentinel day appears as logged in last30', async () => {
    const today = utcDateStr(0)
    const summary = await getEngagementSummary(profileId, userId, new Date())
    expect(summary).not.toBeNull()
    const todayEntry = summary!.last30.find((e) => e.date === today)
    expect(todayEntry).toBeDefined()
    expect(todayEntry!.logged).toBe(true)
  })
})

// ── Test suite 4: period-range day counts as active ──────────────────────────

describe('getEngagementSummary — period log range day counts as active', () => {
  const suffix = 'eng4'
  let profileId: string
  let userId: string

  afterAll(async () => {
    await cleanupTestData(userId)
  })

  it('setup', async () => {
    const result = await createTestUser(suffix)
    userId = result.user.id
    profileId = result.profile.id
  })

  it('a period log spanning today marks loggedToday=true', async () => {
    const yesterday = utcDateStr(-1)
    const tomorrow = utcDateStr(1)

    await testPrisma.periodLog.create({
      data: {
        profileId,
        startDate: new Date(yesterday),
        endDate: new Date(tomorrow),
        flowIntensity: 'MEDIUM',
      },
    })

    const summary = await getEngagementSummary(profileId, userId, new Date())
    expect(summary).not.toBeNull()
    expect(summary!.loggedToday).toBe(true)
    expect(summary!.streak).toBeGreaterThanOrEqual(1)
  })

  it('a period log within the 30-day window marks those days as logged in last30', async () => {
    const threeDaysAgo = utcDateStr(-3)
    const twoDaysAgo = utcDateStr(-2)

    const summary = await getEngagementSummary(profileId, userId, new Date())
    expect(summary).not.toBeNull()

    // Days 3 and 2 ago should be active (covered by yesterday→tomorrow period log above,
    // and threeDaysAgo/twoDaysAgo fall within that range if startDate is yesterday-4)
    // More precisely: yesterday→tomorrow covers yesterday, today, tomorrow.
    // Let's verify at least one of those days is logged
    const yesterdayStr = utcDateStr(-1)
    const yesterdayEntry = summary!.last30.find((e) => e.date === yesterdayStr)
    expect(yesterdayEntry).toBeDefined()
    expect(yesterdayEntry!.logged).toBe(true)
  })
})

// ── Test suite 5: last30 has exactly 30 entries ───────────────────────────────

describe('getEngagementSummary — last30 always has exactly 30 entries', () => {
  const suffix = 'eng5'
  let profileId: string
  let userId: string

  afterAll(async () => {
    await cleanupTestData(userId)
  })

  it('setup', async () => {
    const result = await createTestUser(suffix)
    userId = result.user.id
    profileId = result.profile.id
  })

  it('last30 has exactly 30 entries with no data', async () => {
    const summary = await getEngagementSummary(profileId, userId, new Date())
    expect(summary).not.toBeNull()
    expect(summary!.last30).toHaveLength(30)
  })

  it('last30 is ordered oldest→newest, last entry is today', async () => {
    const summary = await getEngagementSummary(profileId, userId, new Date())
    expect(summary).not.toBeNull()
    const today = utcDateStr(0)
    expect(summary!.last30[summary!.last30.length - 1].date).toBe(today)

    // Verify ordering: each entry is 1 day after the previous
    for (let i = 1; i < summary!.last30.length; i++) {
      const prev = new Date(summary!.last30[i - 1].date)
      const curr = new Date(summary!.last30[i].date)
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
      expect(diffDays).toBe(1)
    }
  })

  it('last30 has exactly 30 entries with some data', async () => {
    await insertSymptomLog(profileId, utcDateStr(0))
    await insertSymptomLog(profileId, utcDateStr(-5))

    const summary = await getEngagementSummary(profileId, userId, new Date())
    expect(summary).not.toBeNull()
    expect(summary!.last30).toHaveLength(30)
  })
})

// ── Test suite 6: sentinel excluded from getSymptomFrequency ─────────────────

describe('getSymptomFrequency — sentinel excluded', () => {
  const suffix = 'eng6'
  let profileId: string
  let userId: string

  afterAll(async () => {
    await cleanupTestData(userId)
  })

  it('setup', async () => {
    const result = await createTestUser(suffix)
    userId = result.user.id
    profileId = result.profile.id
  })

  it('sentinel does not inflate MOOD count', async () => {
    // Insert 1 real MOOD symptom and 1 sentinel
    await insertSymptomLog(profileId, utcDateStr(-1), 'anxiety', 'MOOD')
    await setAllGoodToday(profileId, userId, new Date())

    const freq = await getSymptomFrequency(profileId, userId)

    const moodEntry = freq.find((f) => f.category === 'MOOD')
    expect(moodEntry).toBeDefined()
    // Should be 1 (the real anxiety log), not 2 (sentinel is excluded)
    expect(moodEntry!.count).toBe(1)
  })

  it('sentinel-only day has MOOD count=0 in symptom frequency', async () => {
    // Create fresh profile with only a sentinel
    const sub = await createTestUser(`${suffix}b`)
    await setAllGoodToday(sub.profile.id, sub.user.id, new Date())

    const freq = await getSymptomFrequency(sub.profile.id, sub.user.id)
    const moodEntry = freq.find((f) => f.category === 'MOOD')
    expect(moodEntry).toBeDefined()
    expect(moodEntry!.count).toBe(0)

    await cleanupTestData(sub.user.id)
  })

  it('all categories are always returned (even with zero counts)', async () => {
    const sub = await createTestUser(`${suffix}c`)
    const freq = await getSymptomFrequency(sub.profile.id, sub.user.id)
    expect(freq).toHaveLength(4)
    const categories = freq.map((f) => f.category).sort()
    expect(categories).toEqual(['DISCHARGE', 'LIFESTYLE', 'MOOD', 'PHYSICAL'])
    await cleanupTestData(sub.user.id)
  })
})

// ── Test suite 7: ownership check ────────────────────────────────────────────

describe('getEngagementSummary — ownership check', () => {
  const suffix = 'eng7'
  let profileId: string
  let userId: string

  afterAll(async () => {
    await cleanupTestData(userId)
  })

  it('setup', async () => {
    const result = await createTestUser(suffix)
    userId = result.user.id
    profileId = result.profile.id
  })

  it('returns null for wrong userId', async () => {
    const summary = await getEngagementSummary(profileId, 'wrong-user-id', new Date())
    expect(summary).toBeNull()
  })

  it('returns null for non-existent profileId', async () => {
    const summary = await getEngagementSummary('non-existent-profile', userId, new Date())
    expect(summary).toBeNull()
  })
})
