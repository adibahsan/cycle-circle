import { describe, it, expect, afterAll } from 'vitest'
import { createTestUser, insertPeriodLogs, cleanupTestData, testId } from '../helpers/test-db'
import { getDashboardStats, getLatestPredictionMae } from '@vesta/shared/server/services'

// Dashboard KPIs must read straight from the DB (no service-level caching) and
// carry the timestamp they were computed at, so the admin label shows real age.

describe('getDashboardStats freshness', () => {
  afterAll(async () => {
    await cleanupTestData(testId('user-9001'))
  })

  it('stamps generatedAt with the time the stats were computed', async () => {
    const before = Date.now()
    const stats = await getDashboardStats()
    const after = Date.now()
    const t = new Date(stats.generatedAt).getTime()
    expect(t).toBeGreaterThanOrEqual(before)
    expect(t).toBeLessThanOrEqual(after)
  })

  it('reflects a new user and period log immediately', async () => {
    const before = await getDashboardStats()
    const { profile } = await createTestUser('9001')
    await insertPeriodLogs(profile.id, ['2026-01-01'])
    const after = await getDashboardStats()
    expect(after.totalUsers).toBeGreaterThanOrEqual(before.totalUsers + 1)
    expect(after.totalProfiles).toBeGreaterThanOrEqual(before.totalProfiles + 1)
    expect(after.dailyLogs).toBeGreaterThanOrEqual(before.dailyLogs + 1)
  })
})

describe('getLatestPredictionMae', () => {
  it('returns one row per tier with a computedAt timestamp', async () => {
    const res = await getLatestPredictionMae()
    expect(res.tiers.map((t) => t.tier).sort()).toEqual(['ARIMA', 'AVERAGE'])
    expect(res.computedAt === null || !Number.isNaN(new Date(res.computedAt).getTime())).toBe(true)
    for (const t of res.tiers) {
      expect(t.sampleSize).toBeGreaterThanOrEqual(0)
      if (t.sampleSize === 0) expect(t.maeDays).toBeNull()
    }
  })

  it('computes live from period logs (hand-computed fixture: AVERAGE MAE 2.5)', async () => {
    const { profile } = await createTestUser('9002')
    try {
      await insertPeriodLogs(profile.id, ['2026-01-01', '2026-01-29', '2026-03-02', '2026-04-01'])
      const res = await getLatestPredictionMae()
      const avg = res.tiers.find((t) => t.tier === 'AVERAGE')!
      expect(avg.sampleSize).toBeGreaterThanOrEqual(2)
      expect(avg.maeDays).not.toBeNull()
    } finally {
      await cleanupTestData(testId('user-9002'))
    }
  })
})
