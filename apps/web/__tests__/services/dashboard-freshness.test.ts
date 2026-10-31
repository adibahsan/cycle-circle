import { describe, it, expect, afterAll } from 'vitest'
import { createTestUser, insertPeriodLogs, cleanupTestData, testId, testPrisma } from '../helpers/test-db'
import { getDashboardStats, getLatestPredictionMae } from '@vesta/shared/server/services'

// Dashboard KPIs must read straight from the DB (no service-level caching) and
// carry the timestamp they were computed at, so the admin label shows real age.

describe('getDashboardStats freshness', () => {
  afterAll(async () => {
    await cleanupTestData(testId('user-9001'))
  })

  it('stamps generatedAt with the time the stats were computed', async () => {
    const before = Date.now()
    const stats = await getDashboardStats(new Date())
    const after = Date.now()
    const t = new Date(stats.generatedAt).getTime()
    expect(t).toBeGreaterThanOrEqual(before)
    expect(t).toBeLessThanOrEqual(after)
  })

  it('reflects a new user and period log immediately', async () => {
    await getDashboardStats(new Date()) // a cached implementation would pin this result
    const { profile } = await createTestUser('9001')
    await insertPeriodLogs(profile.id, ['2026-01-01'])

    // This file runs alone, after the parallel group (vitest.config.ts), so the global
    // counts can't move under us. A cached implementation would miss our fixture.
    const [users, profiles] = await Promise.all([
      testPrisma.user.count({ where: { deletedAt: null } }),
      testPrisma.profile.count(),
    ])
    const stats = await getDashboardStats(new Date())
    expect(stats.totalUsers).toBe(users)
    expect(stats.totalProfiles).toBe(profiles)
    expect(stats.dailyLogs).toBeGreaterThanOrEqual(1)
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
})
