import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  testPrisma,
  testId,
  createTestUser,
  insertPeriodLogs,
  cleanupTestData,
  getPrediction,
} from '../helpers/test-db'
import { recalculatePrediction } from '@vesta/shared/server/prediction-calc'

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

describe('recalculatePrediction – 0 period logs', () => {
  const suffix = 'w0'
  let profileId: string
  let userId: string

  beforeAll(async () => {
    const { user, profile } = await createTestUser(suffix)
    userId = user.id
    profileId = profile.id
  })

  afterAll(async () => {
    await cleanupTestData(userId)
  })

  it('creates no prediction when there are no period logs', async () => {
    await recalculatePrediction(profileId)
    const pred = await getPrediction(profileId)
    expect(pred).toBeNull()
  })
})

describe('recalculatePrediction – 1 period log (0 cycle lengths)', () => {
  const suffix = 'w1'
  let profileId: string
  let userId: string

  beforeAll(async () => {
    const { user, profile } = await createTestUser(suffix)
    userId = user.id
    profileId = profile.id
  })

  afterAll(async () => {
    await cleanupTestData(userId)
  })

  beforeEach(async () => {
    await testPrisma.periodLog.deleteMany({ where: { profileId } })
    await testPrisma.prediction.deleteMany({ where: { profileId } })
  })

  it('falls back to profile.cycleLength (28) with tier AVERAGE and confidence 0.50', async () => {
    await insertPeriodLogs(profileId, ['2026-01-01'])
    await recalculatePrediction(profileId)

    const pred = await getPrediction(profileId)
    expect(pred).not.toBeNull()
    expect(pred!.tier).toBe('AVERAGE')
    expect(pred!.confidence).toBeCloseTo(0.5, 5)
    expect(toDateStr(pred!.nextPeriodStart)).toBe('2026-01-29')
  })
})

describe('recalculatePrediction – 2 period logs (1 cycle length)', () => {
  const suffix = 'w2'
  let profileId: string
  let userId: string

  beforeAll(async () => {
    const { user, profile } = await createTestUser(suffix)
    userId = user.id
    profileId = profile.id
  })

  afterAll(async () => {
    await cleanupTestData(userId)
  })

  beforeEach(async () => {
    await testPrisma.periodLog.deleteMany({ where: { profileId } })
    await testPrisma.prediction.deleteMany({ where: { profileId } })
  })

  it('computes avgCycle=30, tier=AVERAGE, confidence=0.55', async () => {
    await insertPeriodLogs(profileId, ['2026-01-01', '2026-01-31'])
    await recalculatePrediction(profileId)

    const pred = await getPrediction(profileId)
    expect(pred).not.toBeNull()
    expect(pred!.tier).toBe('AVERAGE')
    expect(pred!.confidence).toBeCloseTo(0.55, 5)
    expect(toDateStr(pred!.nextPeriodStart)).toBe('2026-03-02')
  })
})

describe('recalculatePrediction – 3 period logs (2 cycle lengths)', () => {
  const suffix = 'w3'
  let profileId: string
  let userId: string

  beforeAll(async () => {
    const { user, profile } = await createTestUser(suffix)
    userId = user.id
    profileId = profile.id
  })

  afterAll(async () => {
    await cleanupTestData(userId)
  })

  beforeEach(async () => {
    await testPrisma.periodLog.deleteMany({ where: { profileId } })
    await testPrisma.prediction.deleteMany({ where: { profileId } })
  })

  it('computes avgCycle=28, tier=AVERAGE, confidence=0.60', async () => {
    await insertPeriodLogs(profileId, ['2026-01-01', '2026-01-29', '2026-02-26'])
    await recalculatePrediction(profileId)

    const pred = await getPrediction(profileId)
    expect(pred).not.toBeNull()
    expect(pred!.tier).toBe('AVERAGE')
    expect(pred!.confidence).toBeCloseTo(0.6, 5)
    expect(toDateStr(pred!.nextPeriodStart)).toBe('2026-03-26')
  })
})

describe('recalculatePrediction – 4 period logs (3 cycle lengths)', () => {
  const suffix = 'w4'
  let profileId: string
  let userId: string

  beforeAll(async () => {
    const { user, profile } = await createTestUser(suffix)
    userId = user.id
    profileId = profile.id
  })

  afterAll(async () => {
    await cleanupTestData(userId)
  })

  beforeEach(async () => {
    await testPrisma.periodLog.deleteMany({ where: { profileId } })
    await testPrisma.prediction.deleteMany({ where: { profileId } })
  })

  it('computes avgCycle=29, confidence=0.65', async () => {
    await insertPeriodLogs(profileId, [
      '2026-01-01',
      '2026-01-29',
      '2026-02-26',
      '2026-03-28',
    ])
    await recalculatePrediction(profileId)

    const pred = await getPrediction(profileId)
    expect(pred).not.toBeNull()
    expect(pred!.tier).toBe('AVERAGE')
    expect(pred!.confidence).toBeCloseTo(0.65, 5)
    // round((28+28+30)/3) = round(28.67) = 29
    expect(toDateStr(pred!.nextPeriodStart)).toBe('2026-04-26')
  })
})

describe('recalculatePrediction – 7 period logs (6 cycle lengths, ARIMA transition)', () => {
  const suffix = 'w5'
  let profileId: string
  let userId: string

  beforeAll(async () => {
    const { user, profile } = await createTestUser(suffix)
    userId = user.id
    profileId = profile.id
  })

  afterAll(async () => {
    await cleanupTestData(userId)
  })

  beforeEach(async () => {
    await testPrisma.periodLog.deleteMany({ where: { profileId } })
    await testPrisma.prediction.deleteMany({ where: { profileId } })
  })

  it('switches to ARIMA tier with weighted average, confidence=0.80', async () => {
    await insertPeriodLogs(profileId, [
      '2026-01-01',
      '2026-01-29',
      '2026-02-26',
      '2026-03-28',
      '2026-04-25',
      '2026-05-23',
      '2026-06-22',
    ])
    await recalculatePrediction(profileId)

    const pred = await getPrediction(profileId)
    expect(pred).not.toBeNull()
    expect(pred!.tier).toBe('ARIMA')
    expect(pred!.confidence).toBeCloseTo(0.8, 5)
    // cycleLengths=[28,28,30,28,28,30], weights=[1,1.5,2,2.5,3,3.5]
    // weighted = (28+42+60+70+84+105)/13.5 = 389/13.5 = 28.81 → 29
    expect(toDateStr(pred!.nextPeriodStart)).toBe('2026-07-21')
  })
})

describe('recalculatePrediction – 11 period logs (10 cycle lengths, confidence capped)', () => {
  const suffix = 'w6'
  let profileId: string
  let userId: string

  beforeAll(async () => {
    const { user, profile } = await createTestUser(suffix)
    userId = user.id
    profileId = profile.id
  })

  afterAll(async () => {
    await cleanupTestData(userId)
  })

  beforeEach(async () => {
    await testPrisma.periodLog.deleteMany({ where: { profileId } })
    await testPrisma.prediction.deleteMany({ where: { profileId } })
  })

  it('caps confidence at 0.95 and uses last 6 cycles for ARIMA', async () => {
    const dates: string[] = []
    const base = new Date('2026-01-01')
    for (let i = 0; i < 11; i++) {
      const d = new Date(base)
      d.setDate(d.getDate() + i * 30)
      dates.push(d.toISOString().slice(0, 10))
    }
    await insertPeriodLogs(profileId, dates)
    await recalculatePrediction(profileId)

    const pred = await getPrediction(profileId)
    expect(pred).not.toBeNull()
    expect(pred!.tier).toBe('ARIMA')
    // min(0.95, 0.5 + 10*0.05) = min(0.95, 1.0) = 0.95
    expect(pred!.confidence).toBeCloseTo(0.95, 5)
    // last 6 cycles all 30 → weighted avg = 30
    const lastLogDate = dates[dates.length - 1]
    const expected = new Date(lastLogDate)
    expected.setDate(expected.getDate() + 30)
    expect(toDateStr(pred!.nextPeriodStart)).toBe(toDateStr(expected))
  })
})

describe('recalculatePrediction – invalid cycle filtering: 0-day gap', () => {
  const suffix = 'w7'
  let profileId: string
  let userId: string

  beforeAll(async () => {
    const { user, profile } = await createTestUser(suffix)
    userId = user.id
    profileId = profile.id
  })

  afterAll(async () => {
    await cleanupTestData(userId)
  })

  beforeEach(async () => {
    await testPrisma.periodLog.deleteMany({ where: { profileId } })
    await testPrisma.prediction.deleteMany({ where: { profileId } })
  })

  it('filters out 0-day diff and falls back to profile.cycleLength', async () => {
    await insertPeriodLogs(profileId, ['2026-01-01', '2026-01-01'])
    await recalculatePrediction(profileId)

    const pred = await getPrediction(profileId)
    expect(pred).not.toBeNull()
    expect(pred!.tier).toBe('AVERAGE')
    expect(pred!.confidence).toBeCloseTo(0.5, 5)
    // fallback to cycleLength=28, last log is '2026-01-01'
    expect(toDateStr(pred!.nextPeriodStart)).toBe('2026-01-29')
  })
})

describe('recalculatePrediction – invalid cycle filtering: 90-day boundary', () => {
  const suffix = 'w8'
  let profileId: string
  let userId: string

  beforeAll(async () => {
    const { user, profile } = await createTestUser(suffix)
    userId = user.id
    profileId = profile.id
  })

  afterAll(async () => {
    await cleanupTestData(userId)
  })

  beforeEach(async () => {
    await testPrisma.periodLog.deleteMany({ where: { profileId } })
    await testPrisma.prediction.deleteMany({ where: { profileId } })
  })

  it('excludes 90-day gap (diff < 90 is strict)', async () => {
    await insertPeriodLogs(profileId, ['2026-01-01', '2026-04-01'])
    await recalculatePrediction(profileId)

    const pred = await getPrediction(profileId)
    expect(pred).not.toBeNull()
    // 90-day diff is excluded → 0 valid cycles → fallback to cycleLength=28
    expect(pred!.confidence).toBeCloseTo(0.5, 5)
    expect(toDateStr(pred!.nextPeriodStart)).toBe('2026-04-29')
  })

  it('includes 89-day gap', async () => {
    await insertPeriodLogs(profileId, ['2026-01-01', '2026-03-31'])
    await recalculatePrediction(profileId)

    const pred = await getPrediction(profileId)
    expect(pred).not.toBeNull()
    expect(pred!.confidence).toBeCloseTo(0.55, 5)
    // 89-day cycle kept → avgCycle=89
    const expected = new Date('2026-03-31')
    expected.setDate(expected.getDate() + 89)
    expect(toDateStr(pred!.nextPeriodStart)).toBe(toDateStr(expected))
  })
})

describe('recalculatePrediction – invalid cycle filtering: mixed valid/invalid', () => {
  const suffix = 'w9'
  let profileId: string
  let userId: string

  beforeAll(async () => {
    const { user, profile } = await createTestUser(suffix)
    userId = user.id
    profileId = profile.id
  })

  afterAll(async () => {
    await cleanupTestData(userId)
  })

  beforeEach(async () => {
    await testPrisma.periodLog.deleteMany({ where: { profileId } })
    await testPrisma.prediction.deleteMany({ where: { profileId } })
  })

  it('keeps only valid diffs [30, 28] from mixed input', async () => {
    // Produces diffs: 30, 0, 91, 28 → valid: [30, 28]
    await insertPeriodLogs(profileId, [
      '2026-01-01',
      '2026-01-31',
      '2026-01-31',
      '2026-05-02',
      '2026-05-30',
    ])
    await recalculatePrediction(profileId)

    const pred = await getPrediction(profileId)
    expect(pred).not.toBeNull()
    expect(pred!.tier).toBe('AVERAGE')
    // round((30+28)/2) = 29
    expect(pred!.confidence).toBeCloseTo(0.6, 5)
    expect(toDateStr(pred!.nextPeriodStart)).toBe('2026-06-28')
  })
})

describe('recalculatePrediction – date calculations verification', () => {
  const suffix = 'w10'
  let profileId: string
  let userId: string

  beforeAll(async () => {
    const { user, profile } = await createTestUser(suffix)
    userId = user.id
    profileId = profile.id
  })

  afterAll(async () => {
    await cleanupTestData(userId)
  })

  beforeEach(async () => {
    await testPrisma.periodLog.deleteMany({ where: { profileId } })
    await testPrisma.prediction.deleteMany({ where: { profileId } })
  })

  it('computes nextPeriodStart, ovulationDay, fertileStart, fertileEnd correctly', async () => {
    await insertPeriodLogs(profileId, ['2026-01-01', '2026-01-29'])
    await recalculatePrediction(profileId)

    const pred = await getPrediction(profileId)
    expect(pred).not.toBeNull()

    // avgCycle=28, lastLog=Jan 29
    // nextPeriodStart = Jan 29 + 28 = Feb 26
    expect(toDateStr(pred!.nextPeriodStart)).toBe('2026-02-26')

    // ovulationDay = Feb 26 - 14 = Feb 12
    expect(toDateStr(pred!.ovulationDay)).toBe('2026-02-12')

    // fertileStart = Feb 12 - 5 = Feb 7
    expect(toDateStr(pred!.fertileStart)).toBe('2026-02-07')

    // fertileEnd = Feb 12 + 1 = Feb 13
    expect(toDateStr(pred!.fertileEnd)).toBe('2026-02-13')
  })
})

describe('recalculatePrediction – profile not found', () => {
  const suffix = 'w11'
  let profileId: string
  let userId: string

  beforeAll(async () => {
    const { user, profile } = await createTestUser(suffix)
    userId = user.id
    profileId = profile.id
  })

  afterAll(async () => {
    await cleanupTestData(userId)
  })

  it('returns without error and creates no prediction when profile is deleted', async () => {
    await insertPeriodLogs(profileId, ['2026-01-01'])

    await testPrisma.profile.delete({ where: { id: profileId } })

    await expect(recalculatePrediction(profileId)).resolves.toBeUndefined()

    const pred = await getPrediction(profileId)
    expect(pred).toBeNull()
  })
})
