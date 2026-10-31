import { describe, it, expect, afterAll, beforeEach } from 'vitest'
import {
  ensurePeriodLogFromProfile,
  getLatestPeriodLog,
} from '@vesta/shared/server/period-log-sync'
import { dayToStoredDate } from '@vesta/shared/utils/dhaka-date'
import {
  createTestUser,
  cleanupTestData,
  testPrisma,
  testId,
  getPrediction,
} from '../helpers/test-db'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Create a midnight-UTC Date for a given YYYY-MM-DD string. */
function d(dateStr: string): Date {
  return dayToStoredDate(dateStr)
}

/** Extract YYYY-MM-DD from a Date. */

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// ensurePeriodLogFromProfile — real DB tests
// ---------------------------------------------------------------------------

describe('ensurePeriodLogFromProfile', () => {
  const suffixes = ['sync1', 'sync2', 'sync3', 'sync4', 'sync5']

  afterAll(async () => {
    for (const suffix of suffixes) {
      await cleanupTestData(testId(`user-${suffix}`)).catch(() => {})
    }
    // Also clean up the manually-created user for the null-lastPeriodStart test
    await cleanupTestData(testId('user-sync-null')).catch(() => {})
  })

  // --- Test 1: null lastPeriodStart ------------------------------------------

  it('returns null when profile has no lastPeriodStart', async () => {
    const userId = testId('user-sync-null')
    const profileId = testId('profile-sync-null')

    // Create user + profile manually without lastPeriodStart
    await testPrisma.user.create({
      data: {
        id: userId,
        phone: '+8801700000099',
        fullName: 'Test Null LPS',
        authMethod: 'OTP',
        profileCompleted: true,
      },
    })
    const profile = await testPrisma.profile.create({
      data: {
        id: profileId,
        userId,
        name: 'No LPS Profile',
        relation: 'SELF',
        cycleLength: 28,
        periodLength: 5,
        lastPeriodStart: null,
      },
    })

    const result = await ensurePeriodLogFromProfile(profile)

    expect(result).toBeNull()

    // No period log should have been created
    const logCount = await testPrisma.periodLog.count({ where: { profileId } })
    expect(logCount).toBe(0)

    // No prediction should have been created
    const prediction = await getPrediction(profileId)
    expect(prediction).toBeNull()
  })

  // --- Test 2: creates log + prediction when no existing logs ----------------

  describe('profile with lastPeriodStart and no existing logs', () => {
    let profileId: string
    let userId: string

    beforeEach(async () => {
      const suffix = 'sync1'
      userId = testId(`user-${suffix}`)
      profileId = testId(`profile-${suffix}`)

      // Clean any leftovers from prior runs
      await cleanupTestData(userId).catch(() => {})

      const { profile } = await createTestUser(suffix)
      profileId = profile.id

      // Ensure no pre-existing logs
      await testPrisma.periodLog.deleteMany({ where: { profileId } })
      await testPrisma.prediction.deleteMany({ where: { profileId } })
    })

    afterAll(async () => {
      await cleanupTestData(testId('user-sync1')).catch(() => {})
    })

    it('creates a PeriodLog with correct dates and flowIntensity', async () => {
      const profile = await testPrisma.profile.findUniqueOrThrow({ where: { id: profileId } })
      const result = await ensurePeriodLogFromProfile(profile)

      expect(result).not.toBeNull()
      expect(result!.profileId).toBe(profileId)
      expect(ymd(result!.startDate)).toBe('2026-01-01')
      // endDate = startDate + max(5, 1) - 1 = Jan 1 + 4 = Jan 5
      expect(ymd(result!.endDate)).toBe('2026-01-05')
      expect(result!.flowIntensity).toBe('MEDIUM')
    })

    it('seeds a Tier 1 prediction with correct dates and confidence', async () => {
      const profile = await testPrisma.profile.findUniqueOrThrow({ where: { id: profileId } })
      await ensurePeriodLogFromProfile(profile)

      const prediction = await getPrediction(profileId)
      expect(prediction).not.toBeNull()
      expect(prediction!.tier).toBe('AVERAGE')
      expect(prediction!.confidence).toBe(0.5)
      // nextPeriodStart = Jan 1 + 28 = Jan 29
      expect(ymd(prediction!.nextPeriodStart)).toBe('2026-01-29')
      // ovulationDay = Jan 29 - 14 = Jan 15
      expect(ymd(prediction!.ovulationDay)).toBe('2026-01-15')
      // fertileStart = Jan 15 - 5 = Jan 10
      expect(ymd(prediction!.fertileStart)).toBe('2026-01-10')
      // fertileEnd = Jan 15 + 1 = Jan 16
      expect(ymd(prediction!.fertileEnd)).toBe('2026-01-16')
    })

    it('recalculates the prediction synchronously (no job queue)', async () => {
      const profile = await testPrisma.profile.findUniqueOrThrow({ where: { id: profileId } })

      // Remove any existing prediction so we can prove it is recomputed inline.
      await testPrisma.prediction.deleteMany({ where: { profileId } })

      await ensurePeriodLogFromProfile(profile)

      // recalculatePrediction is now called directly (the JobEvent queue path
      // was removed), so the Prediction must exist immediately afterwards.
      const prediction = await getPrediction(profileId)
      expect(prediction).not.toBeNull()
      expect(prediction!.profileId).toBe(profileId)
    })
  })

  // --- Test 3: returns existing log, does not create new one -----------------

  it('returns existing log without creating a new one', async () => {
    const suffix = 'sync2'
    const userId = testId(`user-${suffix}`)

    // Clean up first
    await cleanupTestData(userId).catch(() => {})

    const { profile } = await createTestUser(suffix)

    // Insert a period log manually before calling the function
    const existingLog = await testPrisma.periodLog.create({
      data: {
        profileId: profile.id,
        startDate: d('2025-12-01'),
        endDate: d('2025-12-05'),
        flowIntensity: 'HEAVY',
      },
    })

    const predictionCountBefore = await testPrisma.prediction.count({
      where: { profileId: profile.id },
    })
    const jobCountBefore = await testPrisma.jobEvent.count({
      where: { type: 'PREDICTION_RECALC' },
    })

    const result = await ensurePeriodLogFromProfile(profile)

    expect(result).not.toBeNull()
    expect(result!.id).toBe(existingLog.id)
    expect(result!.flowIntensity).toBe('HEAVY')

    // No new log should have been created
    const logCount = await testPrisma.periodLog.count({ where: { profileId: profile.id } })
    expect(logCount).toBe(1)

    // No new prediction or job event should have been created
    const predictionCountAfter = await testPrisma.prediction.count({
      where: { profileId: profile.id },
    })
    expect(predictionCountAfter).toBe(predictionCountBefore)

    const jobCountAfter = await testPrisma.jobEvent.count({
      where: { type: 'PREDICTION_RECALC' },
    })
    expect(jobCountAfter).toBe(jobCountBefore)
  })

  // --- Test 4: cycleLength=35 shifts prediction dates accordingly ------------

  it('computes correct prediction dates for cycleLength=35', async () => {
    const suffix = 'sync3'
    const userId = testId(`user-${suffix}`)

    await cleanupTestData(userId).catch(() => {})

    const user = await testPrisma.user.create({
      data: {
        id: userId,
        phone: '+8801700000033',
        fullName: 'Test CL35',
        authMethod: 'OTP',
        profileCompleted: true,
      },
    })

    const profileId = testId(`profile-${suffix}`)
    const profile = await testPrisma.profile.create({
      data: {
        id: profileId,
        userId: user.id,
        name: 'CL35 Profile',
        relation: 'SELF',
        cycleLength: 35,
        periodLength: 5,
        lastPeriodStart: d('2026-01-01'),
      },
    })

    const result = await ensurePeriodLogFromProfile(profile)
    expect(result).not.toBeNull()
    expect(ymd(result!.startDate)).toBe('2026-01-01')
    expect(ymd(result!.endDate)).toBe('2026-01-05')

    const prediction = await getPrediction(profileId)
    expect(prediction).not.toBeNull()
    // nextPeriodStart = Jan 1 + 35 = Feb 5
    expect(ymd(prediction!.nextPeriodStart)).toBe('2026-02-05')
    // ovulationDay = Feb 5 - 14 = Jan 22
    expect(ymd(prediction!.ovulationDay)).toBe('2026-01-22')
    // fertileStart = Jan 22 - 5 = Jan 17
    expect(ymd(prediction!.fertileStart)).toBe('2026-01-17')
    // fertileEnd = Jan 22 + 1 = Jan 23
    expect(ymd(prediction!.fertileEnd)).toBe('2026-01-23')
  })

  // --- Test 5: periodLength=1 ------------------------------------------------

  it('sets endDate equal to startDate when periodLength is 1', async () => {
    const suffix = 'sync4'
    const userId = testId(`user-${suffix}`)

    await cleanupTestData(userId).catch(() => {})

    const user = await testPrisma.user.create({
      data: {
        id: userId,
        phone: '+8801700000044',
        fullName: 'Test PL1',
        authMethod: 'OTP',
        profileCompleted: true,
      },
    })

    const profileId = testId(`profile-${suffix}`)
    const profile = await testPrisma.profile.create({
      data: {
        id: profileId,
        userId: user.id,
        name: 'PL1 Profile',
        relation: 'SELF',
        cycleLength: 28,
        periodLength: 1,
        lastPeriodStart: d('2026-01-01'),
      },
    })

    const result = await ensurePeriodLogFromProfile(profile)
    expect(result).not.toBeNull()
    // endDate = startDate + max(1, 1) - 1 = startDate + 0 = startDate
    expect(ymd(result!.startDate)).toBe('2026-01-01')
    expect(ymd(result!.endDate)).toBe('2026-01-01')
  })
})

// ---------------------------------------------------------------------------
// getLatestPeriodLog — delegates to ensurePeriodLogFromProfile
// ---------------------------------------------------------------------------

describe('getLatestPeriodLog', () => {
  const suffix = 'sync5'

  afterAll(async () => {
    await cleanupTestData(testId(`user-${suffix}`)).catch(() => {})
  })

  it('returns the same result as ensurePeriodLogFromProfile', async () => {
    const userId = testId(`user-${suffix}`)

    await cleanupTestData(userId).catch(() => {})

    const { profile } = await createTestUser(suffix)

    // Ensure no pre-existing logs so ensurePeriodLogFromProfile will create one
    await testPrisma.periodLog.deleteMany({ where: { profileId: profile.id } })
    await testPrisma.prediction.deleteMany({ where: { profileId: profile.id } })

    const result = await getLatestPeriodLog(profile)

    expect(result).not.toBeNull()
    expect(result!.profileId).toBe(profile.id)
    expect(ymd(result!.startDate)).toBe('2026-01-01')
    expect(ymd(result!.endDate)).toBe('2026-01-05')
    expect(result!.flowIntensity).toBe('MEDIUM')

    // Verify a prediction was also created (same side effect as ensurePeriodLogFromProfile)
    const prediction = await getPrediction(profile.id)
    expect(prediction).not.toBeNull()
    expect(prediction!.tier).toBe('AVERAGE')
  })

  it('returns a logged period even when profile.lastPeriodStart is null (#154)', async () => {
    const suffix2 = 'sync6'
    const userId = testId(`user-${suffix2}`)
    await cleanupTestData(userId).catch(() => {})
    const { profile } = await createTestUser(suffix2)
    const noLps = await testPrisma.profile.update({ where: { id: profile.id }, data: { lastPeriodStart: null } })
    await testPrisma.periodLog.create({
      data: { profileId: profile.id, startDate: d('2026-02-03'), endDate: d('2026-02-07'), flowIntensity: 'HEAVY' },
    })

    const result = await getLatestPeriodLog(noLps)

    expect(result).not.toBeNull()
    expect(ymd(result!.startDate)).toBe('2026-02-03')
    expect(result!.flowIntensity).toBe('HEAVY')
    await cleanupTestData(userId).catch(() => {})
  })
})
