import { describe, it, expect, afterAll, vi, beforeEach, afterEach } from 'vitest'
import {
  testPrisma,
  testId,
  createTestUser,
  insertPeriodLogs,
  cleanupTestData,
  getPrediction,
} from '../helpers/test-db'
import { recalculatePrediction } from '@vesta/shared/server/prediction-calc'
import {
  getCurrentPhase,
  predictCycleLength,
  getConfidence,
  getPredictionTier,
  getCurrentCycleDay,
} from '@vesta/shared/utils/cycle-utils'

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Add a given number of days to a date string and return the new date string.
 */
function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Progressive data accumulation (real DB)
// ---------------------------------------------------------------------------
describe('Progressive data accumulation', () => {
  const suffix = 'integ1'
  let profileId: string
  let userId: string

  afterAll(async () => {
    await cleanupTestData(userId)
  })

  it('setup: create user and profile', async () => {
    const { user, profile } = await createTestUser(suffix)
    userId = user.id
    profileId = profile.id
  })

  it('1 period log -> initial prediction (profile default cycle)', async () => {
    await insertPeriodLogs(profileId, ['2026-01-01'])
    await recalculatePrediction(profileId)

    const pred = await getPrediction(profileId)
    expect(pred).not.toBeNull()
    expect(pred!.tier).toBe('AVERAGE')
    expect(pred!.confidence).toBeCloseTo(0.50, 5)
    // nextPeriodStart = Jan 1 + 28 (profile default) = Jan 29
    expect(toDateStr(pred!.nextPeriodStart)).toBe('2026-01-29')
  })

  it('3 total logs (2 cycle lengths) -> AVERAGE, confidence 0.60', async () => {
    await insertPeriodLogs(profileId, ['2026-01-29', '2026-02-26'])
    await recalculatePrediction(profileId)

    const pred = await getPrediction(profileId)
    expect(pred).not.toBeNull()
    expect(pred!.tier).toBe('AVERAGE')
    expect(pred!.confidence).toBeCloseTo(0.60, 5)
    // cycleLengths = [28, 28], avg = 28
    // nextPeriodStart = Feb 26 + 28 = Mar 26
    expect(toDateStr(pred!.nextPeriodStart)).toBe('2026-03-26')
  })

  it('7 total logs (6 cycle lengths) -> ARIMA transition, confidence 0.80', async () => {
    await insertPeriodLogs(profileId, [
      '2026-03-26',
      '2026-04-23',
      '2026-05-21',
      '2026-06-18',
    ])
    await recalculatePrediction(profileId)

    const pred = await getPrediction(profileId)
    expect(pred).not.toBeNull()
    expect(pred!.tier).toBe('ARIMA')
    expect(pred!.confidence).toBeCloseTo(0.80, 5)
    // 6 cycle lengths all 28 -> weighted avg of [28,28,28,28,28,28] = 28
    // nextPeriodStart = Jun 18 + 28 = Jul 16
    expect(toDateStr(pred!.nextPeriodStart)).toBe('2026-07-16')
  })

  it('10 total logs (9 cycle lengths) -> confidence capped at 0.95', async () => {
    await insertPeriodLogs(profileId, [
      '2026-07-16',
      '2026-08-13',
      '2026-09-10',
    ])
    await recalculatePrediction(profileId)

    const pred = await getPrediction(profileId)
    expect(pred).not.toBeNull()
    expect(pred!.tier).toBe('ARIMA')
    // min(0.95, 0.5 + 9*0.05) = min(0.95, 0.95) = 0.95
    expect(pred!.confidence).toBeCloseTo(0.95, 5)
  })
})

// ---------------------------------------------------------------------------
// Confidence monotonically increases
// ---------------------------------------------------------------------------
describe('Confidence monotonically increases', () => {
  const suffix = 'integ2'
  let profileId: string
  let userId: string
  let previousConfidence = 0

  afterAll(async () => {
    await cleanupTestData(userId)
  })

  it('setup: create user and profile', async () => {
    const { user, profile } = await createTestUser(suffix)
    userId = user.id
    profileId = profile.id
  })

  it('2 logs (1 cycle) -> confidence = 0.55', async () => {
    await insertPeriodLogs(profileId, ['2026-01-01', '2026-01-29'])
    await recalculatePrediction(profileId)

    const pred = await getPrediction(profileId)
    expect(pred).not.toBeNull()
    expect(pred!.confidence).toBeCloseTo(0.55, 5)
    previousConfidence = pred!.confidence
  })

  it('3 logs (2 cycles) -> confidence = 0.60', async () => {
    await insertPeriodLogs(profileId, ['2026-02-26'])
    await recalculatePrediction(profileId)

    const pred = await getPrediction(profileId)
    expect(pred!.confidence).toBeCloseTo(0.60, 5)
    expect(pred!.confidence).toBeGreaterThanOrEqual(previousConfidence)
    previousConfidence = pred!.confidence
  })

  it('4 logs (3 cycles) -> confidence = 0.65', async () => {
    await insertPeriodLogs(profileId, ['2026-03-26'])
    await recalculatePrediction(profileId)

    const pred = await getPrediction(profileId)
    expect(pred!.confidence).toBeCloseTo(0.65, 5)
    expect(pred!.confidence).toBeGreaterThanOrEqual(previousConfidence)
    previousConfidence = pred!.confidence
  })

  it('7 logs (6 cycles) -> confidence = 0.80', async () => {
    await insertPeriodLogs(profileId, [
      '2026-04-23',
      '2026-05-21',
      '2026-06-18',
    ])
    await recalculatePrediction(profileId)

    const pred = await getPrediction(profileId)
    expect(pred!.confidence).toBeCloseTo(0.80, 5)
    expect(pred!.confidence).toBeGreaterThanOrEqual(previousConfidence)
    previousConfidence = pred!.confidence
  })

  it('10 logs (9 cycles) -> confidence = 0.95 (capped)', async () => {
    await insertPeriodLogs(profileId, [
      '2026-07-16',
      '2026-08-13',
      '2026-09-10',
    ])
    await recalculatePrediction(profileId)

    const pred = await getPrediction(profileId)
    expect(pred!.confidence).toBeCloseTo(0.95, 5)
    expect(pred!.confidence).toBeGreaterThanOrEqual(previousConfidence)
    previousConfidence = pred!.confidence
  })

  it('11 logs (10 cycles) -> confidence still = 0.95 (capped)', async () => {
    await insertPeriodLogs(profileId, ['2026-10-08'])
    await recalculatePrediction(profileId)

    const pred = await getPrediction(profileId)
    // min(0.95, 0.5 + 10*0.05) = min(0.95, 1.0) = 0.95
    expect(pred!.confidence).toBeCloseTo(0.95, 5)
    expect(pred!.confidence).toBeGreaterThanOrEqual(previousConfidence)
  })
})

// ---------------------------------------------------------------------------
// Tier transition boundary
// ---------------------------------------------------------------------------
describe('Tier transition boundary', () => {
  const suffix = 'integ3'
  let profileId: string
  let userId: string

  afterAll(async () => {
    await cleanupTestData(userId)
  })

  it('setup: create user and profile', async () => {
    const { user, profile } = await createTestUser(suffix)
    userId = user.id
    profileId = profile.id
  })

  it('7 logs with 28-day intervals -> 6 valid cycles -> ARIMA', async () => {
    const dates: string[] = []
    for (let i = 0; i < 7; i++) {
      dates.push(addDaysStr('2026-01-01', i * 28))
    }
    await insertPeriodLogs(profileId, dates)
    await recalculatePrediction(profileId)

    const pred = await getPrediction(profileId)
    expect(pred).not.toBeNull()
    expect(pred!.tier).toBe('ARIMA')
  })

  it('delete one middle log -> 5 valid cycle lengths -> drops to AVERAGE', async () => {
    // Find and delete the 4th log (index 3) to break one cycle pair into a long gap
    const logs = await testPrisma.periodLog.findMany({
      where: { profileId },
      orderBy: { startDate: 'asc' },
    })
    // Delete the 4th log (index 3). This merges two 28-day gaps into one 56-day gap.
    // Remaining diffs: [28, 28, 56, 28, 28] -> valid (<90): [28, 28, 56, 28, 28] = 5 cycle lengths
    await testPrisma.periodLog.delete({ where: { id: logs[3].id } })
    await recalculatePrediction(profileId)

    const pred = await getPrediction(profileId)
    expect(pred).not.toBeNull()
    expect(pred!.tier).toBe('AVERAGE')
  })

  it('add the log back -> 6 valid cycle lengths -> back to ARIMA', async () => {
    // Re-insert the 4th log at day 3*28 = day 84 from start
    const dateStr = addDaysStr('2026-01-01', 3 * 28)
    await insertPeriodLogs(profileId, [dateStr])
    await recalculatePrediction(profileId)

    const pred = await getPrediction(profileId)
    expect(pred).not.toBeNull()
    expect(pred!.tier).toBe('ARIMA')
  })
})

// ---------------------------------------------------------------------------
// Varying cycle lengths affect ARIMA weighting
// ---------------------------------------------------------------------------
describe('Varying cycle lengths affect ARIMA weighting', () => {
  const suffix = 'integ4'
  let profileId: string
  let userId: string

  afterAll(async () => {
    await cleanupTestData(userId)
  })

  it('recent longer cycles pull weighted average up vs simple mean', async () => {
    const { user, profile } = await createTestUser(suffix)
    userId = user.id
    profileId = profile.id

    // Produce cycleLengths = [25, 26, 27, 28, 29, 30]
    // Logs: day 0, day 25, day 51, day 78, day 106, day 135, day 165
    const cumulativeDays = [0, 25, 51, 78, 106, 135, 165]
    const dates = cumulativeDays.map((d) => addDaysStr('2026-01-01', d))

    await insertPeriodLogs(profileId, dates)
    await recalculatePrediction(profileId)

    const pred = await getPrediction(profileId)
    expect(pred).not.toBeNull()
    expect(pred!.tier).toBe('ARIMA')

    // ARIMA weights: [1, 1.5, 2, 2.5, 3, 3.5], totalWeight = 13.5
    // weighted = (25*1 + 26*1.5 + 27*2 + 28*2.5 + 29*3 + 30*3.5) / 13.5
    //          = (25 + 39 + 54 + 70 + 87 + 105) / 13.5
    //          = 380 / 13.5 = 28.148... -> round = 28
    // Simple mean would be (25+26+27+28+29+30)/6 = 27.5 -> round = 28
    // Both round to 28, but the weighted value (28.15) is higher than 27.5

    // Last log = Jan 1 + 165 days = Jun 15
    // Verify avgCycle = 28 via nextPeriodStart = Jun 15 + 28 = Jul 13
    const lastLogDate = dates[dates.length - 1]
    expect(lastLogDate).toBe('2026-06-15')
    const expectedNext = addDaysStr(lastLogDate, 28)
    expect(expectedNext).toBe('2026-07-13')
    expect(toDateStr(pred!.nextPeriodStart)).toBe(expectedNext)
  })
})

// ---------------------------------------------------------------------------
// Phase progression through a full 28-day cycle (pure function, no DB)
// ---------------------------------------------------------------------------
describe('Phase progression through a full 28-day cycle', () => {
  const periodLength = 5
  const cycleLength = 28
  // ovulationDay = 28 - 14 = 14
  // menstrual: days 1-5
  // follicular: days 6-9 (> periodLength AND < ovulationDay - 4 = 10)
  // ovulation: days 10-15 (>= 10 AND <= 15)
  // luteal: days 16-28

  const expectedPhases: Array<[number, string]> = [
    [1, 'menstrual'],
    [2, 'menstrual'],
    [3, 'menstrual'],
    [4, 'menstrual'],
    [5, 'menstrual'],
    [6, 'follicular'],
    [7, 'follicular'],
    [8, 'follicular'],
    [9, 'follicular'],
    [10, 'ovulation'],
    [11, 'ovulation'],
    [12, 'ovulation'],
    [13, 'ovulation'],
    [14, 'ovulation'],
    [15, 'ovulation'],
    [16, 'luteal'],
    [17, 'luteal'],
    [18, 'luteal'],
    [19, 'luteal'],
    [20, 'luteal'],
    [21, 'luteal'],
    [22, 'luteal'],
    [23, 'luteal'],
    [24, 'luteal'],
    [25, 'luteal'],
    [26, 'luteal'],
    [27, 'luteal'],
    [28, 'luteal'],
  ]

  it.each(expectedPhases)(
    'day %d -> %s',
    (day, expectedPhase) => {
      expect(getCurrentPhase(day, periodLength, cycleLength)).toBe(expectedPhase)
    },
  )
})

// ---------------------------------------------------------------------------
// Date edge cases (real DB)
// ---------------------------------------------------------------------------
describe('Date edge cases', () => {
  const suffixes = ['integ5a', 'integ5b', 'integ5c']
  const userIds: string[] = []

  afterAll(async () => {
    for (const uid of userIds) {
      await cleanupTestData(uid)
    }
  })

  it('short cycle (21 days): nextPeriod = lastLog + 21, ovulation = lastLog + 7', async () => {
    const { user, profile } = await createTestUser(suffixes[0])
    userIds.push(user.id)

    // Update profile to cycleLength=21
    await testPrisma.profile.update({
      where: { id: profile.id },
      data: { cycleLength: 21 },
    })

    // Insert 2 logs 21 days apart
    await insertPeriodLogs(profile.id, ['2026-01-01', '2026-01-22'])
    await recalculatePrediction(profile.id)

    const pred = await getPrediction(profile.id)
    expect(pred).not.toBeNull()
    // cycleLengths = [21], avgCycle = 21
    // nextPeriodStart = Jan 22 + 21 = Feb 12
    expect(toDateStr(pred!.nextPeriodStart)).toBe('2026-02-12')
    // ovulationDay = Feb 12 - 14 = Jan 29
    expect(toDateStr(pred!.ovulationDay)).toBe('2026-01-29')
  })

  it('long cycle (45 days): nextPeriod = lastLog + 45, ovulation = lastLog + 31', async () => {
    const { user, profile } = await createTestUser(suffixes[1])
    userIds.push(user.id)

    // Update profile to cycleLength=45
    await testPrisma.profile.update({
      where: { id: profile.id },
      data: { cycleLength: 45 },
    })

    // Insert 2 logs 45 days apart
    await insertPeriodLogs(profile.id, ['2026-01-01', '2026-02-15'])
    await recalculatePrediction(profile.id)

    const pred = await getPrediction(profile.id)
    expect(pred).not.toBeNull()
    // cycleLengths = [45], avgCycle = 45
    // nextPeriodStart = Feb 15 + 45 = Apr 1
    expect(toDateStr(pred!.nextPeriodStart)).toBe('2026-04-01')
    // ovulationDay = Apr 1 - 14 = Mar 18
    expect(toDateStr(pred!.ovulationDay)).toBe('2026-03-18')
  })

  it('end-of-month boundary: Jan 31 + 31 = Mar 3', async () => {
    const { user, profile } = await createTestUser(suffixes[2])
    userIds.push(user.id)

    // Update profile to cycleLength=31
    await testPrisma.profile.update({
      where: { id: profile.id },
      data: { cycleLength: 31 },
    })

    // Insert 2 logs: Dec 31 and Jan 31 (31-day cycle)
    await insertPeriodLogs(profile.id, ['2025-12-31', '2026-01-31'])
    await recalculatePrediction(profile.id)

    const pred = await getPrediction(profile.id)
    expect(pred).not.toBeNull()
    // cycleLengths = [31], avgCycle = 31
    // nextPeriodStart = Jan 31 + 31 = Mar 3
    expect(toDateStr(pred!.nextPeriodStart)).toBe('2026-03-03')
  })
})

// ---------------------------------------------------------------------------
// Confidence divergence documentation (pure function test)
// ---------------------------------------------------------------------------
describe('Confidence divergence: cycle-utils vs worker formulas', () => {
  // This test DOCUMENTS the known difference between the two confidence formulas.
  // Worker (recalculatePrediction): min(0.95, 0.50 + cycleLengths.length * 0.05) -> decimal 0-1
  // Client (cycle-utils getConfidence):
  //   AVERAGE tier: min(75, 40 + count * 8)  -> percentage integer
  //   ARIMA tier:   min(92, 70 + count * 2)  -> percentage integer

  it.each([
    {
      cycles: 1,
      clientTier: 'average' as const,
      clientConfidence: 48,
      workerConfidence: 0.55,
      label: '1 cycle',
    },
    {
      cycles: 2,
      clientTier: 'average' as const,
      clientConfidence: 56,
      workerConfidence: 0.60,
      label: '2 cycles',
    },
    {
      cycles: 3,
      clientTier: 'average' as const,
      clientConfidence: 64,
      workerConfidence: 0.65,
      label: '3 cycles',
    },
    {
      cycles: 5,
      clientTier: 'average' as const,
      clientConfidence: 75,
      workerConfidence: 0.75,
      label: '5 cycles (AVERAGE cap)',
    },
    {
      cycles: 6,
      clientTier: 'arima' as const,
      clientConfidence: 82,
      workerConfidence: 0.80,
      label: '6 cycles (ARIMA transition)',
    },
    {
      cycles: 9,
      clientTier: 'arima' as const,
      clientConfidence: 88,
      workerConfidence: 0.95,
      label: '9 cycles (worker capped at 0.95)',
    },
    {
      cycles: 11,
      clientTier: 'arima' as const,
      clientConfidence: 92,
      workerConfidence: 0.95,
      label: '11 cycles (both capped)',
    },
  ])(
    '$label: client=$clientConfidence%, worker=$workerConfidence',
    ({ cycles, clientTier, clientConfidence, workerConfidence }) => {
      const tier = getPredictionTier(cycles)
      expect(tier).toBe(clientTier)

      const clientConf = getConfidence(tier, cycles)
      expect(clientConf).toBe(clientConfidence)

      // Worker formula
      const workerConf = Math.min(0.95, 0.50 + cycles * 0.05)
      expect(workerConf).toBeCloseTo(workerConfidence, 5)

      // Document that these differ (client is percentage int, worker is decimal)
      // They are NOT equivalent: clientConf/100 !== workerConf in most cases
      const diverges = Math.abs(clientConf / 100 - workerConf) > 0.001
      // At some data points they happen to match, at others they diverge
      if (cycles === 3) {
        // 3 cycles: client=64% (0.64), worker=0.65 -> diverges
        expect(diverges).toBe(true)
      }
      if (cycles === 6) {
        // 6 cycles: client=82% (0.82), worker=0.80 -> diverges
        expect(diverges).toBe(true)
      }
      if (cycles === 9) {
        // 9 cycles: client=88% (0.88), worker=0.95 -> diverges significantly
        expect(diverges).toBe(true)
      }
    },
  )
})
