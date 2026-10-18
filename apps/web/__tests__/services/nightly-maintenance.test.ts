import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { testPrisma } from '../helpers/test-db'
import { logger } from '@vesta/shared/server/log'
import {
  computePredictionMaeByTier,
  writePredictionSnapshot,
  snapshotPredictionAccuracy,
  purgeExpiredDeletedUsers,
  getLatestPredictionMae,
  getPredictionMaeTrend,
} from '@vesta/shared/server/services'

const P = 'test-nm'
const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2031-06-15T02:30:00Z') // far future: latest snapshot stays ours
const ids = (n: string) => ({ user: `${P}-u-${n}`, profile: `${P}-p-${n}` })

async function makeUser(n: string, deletedAt: Date | null) {
  const { user, profile } = ids(n)
  await testPrisma.user.create({
    data: { id: user, phone: `+88019${n.padStart(8, '0')}`, authMethod: 'OTP', deletedAt },
  })
  await testPrisma.profile.create({ data: { id: profile, userId: user, name: 'P', relation: 'SELF' } })
  await testPrisma.periodLog.create({
    data: { profileId: profile, startDate: NOW, endDate: NOW, flowIntensity: 'MEDIUM' },
  })
  await testPrisma.symptomLog.create({
    data: { profileId: profile, date: NOW, category: 'PHYSICAL', symptomId: 'cramps', value: '1' },
  })
  await testPrisma.feedback.create({ data: { userId: user, category: 'GENERAL', message: 'hi' } })
  await testPrisma.subscription.create({ data: { userId: user } })
}

async function cleanup() {
  await testPrisma.user.deleteMany({ where: { id: { startsWith: P } } })
  await testPrisma.predictionAccuracySnapshot.deleteMany({ where: { date: { gte: new Date('2031-01-01') } } })
}

beforeAll(cleanup)
afterEach(() => vi.restoreAllMocks())
afterAll(async () => {
  await cleanup()
  await testPrisma.$disconnect()
})

describe('prediction accuracy snapshot', () => {
  it('stores per-tier values matching the hand-computed fixture and the latest read returns them', async () => {
    // starts Jan 1, Jan 29, Mar 2, Apr 1 -> AVERAGE: errors 4 and 1 -> MAE 2.5 over 2 samples
    const t0 = Date.UTC(2026, 0, 1)
    const tiers = computePredictionMaeByTier([[t0, t0 + 28 * DAY, t0 + 60 * DAY, t0 + 90 * DAY]])
    expect(tiers.find((t) => t.tier === 'AVERAGE')).toEqual({ tier: 'AVERAGE', maeDays: 2.5, sampleSize: 2 })

    await writePredictionSnapshot(NOW, tiers)
    const rows = await testPrisma.predictionAccuracySnapshot.findMany({ where: { date: new Date('2031-06-15') } })
    expect(rows.map((r) => r.tier).sort()).toEqual(['ARIMA', 'AVERAGE'])
    const latest = await getLatestPredictionMae()
    expect(latest.tiers.find((t) => t.tier === 'AVERAGE')).toEqual({ tier: 'AVERAGE', maeDays: 2.5, sampleSize: 2 })
    expect(latest.tiers.find((t) => t.tier === 'ARIMA')).toEqual({ tier: 'ARIMA', maeDays: null, sampleSize: 0 })
    expect(latest.computedAt).not.toBeNull()
  })

  it('is one row per tier per night: re-running the same date overwrites', async () => {
    await snapshotPredictionAccuracy(NOW)
    await snapshotPredictionAccuracy(NOW)
    expect(await testPrisma.predictionAccuracySnapshot.count({ where: { date: new Date('2031-06-15') } })).toBe(2)
  })

  it('trend lists snapshots oldest first', async () => {
    await writePredictionSnapshot(new Date('2031-06-16T02:30:00Z'), [
      { tier: 'AVERAGE', maeDays: 3, sampleSize: 4 },
      { tier: 'ARIMA', maeDays: null, sampleSize: 0 },
    ])
    const trend = await getPredictionMaeTrend({ from: new Date('2031-06-01'), to: new Date('2031-07-01') })
    const avg = trend.filter((r) => r.tier === 'AVERAGE')
    expect(avg.map((r) => r.date)).toEqual(['2031-06-15', '2031-06-16'])
    expect(avg[1].maeDays).toBe(3)
  })
})

describe('purgeExpiredDeletedUsers', () => {
  it('purges only users deleted more than 30 days ago, with all their data, one translog line each', async () => {
    await makeUser('1', new Date(NOW.getTime() - 30 * DAY - 1)) // just past the window
    await makeUser('2', new Date(NOW.getTime() - 30 * DAY)) // exactly 30 days: still restorable
    await makeUser('3', null) // not deleted
    const translog = vi.spyOn(logger, 'translog').mockImplementation(() => {})

    const res = await purgeExpiredDeletedUsers(NOW)

    expect(res.failed).toBe(0)
    expect(res.purgedUserIds).toContain(ids('1').user)
    expect(res.purgedUserIds).not.toContain(ids('2').user)
    const count = async (n: string) => ({
      user: await testPrisma.user.count({ where: { id: ids(n).user } }),
      profile: await testPrisma.profile.count({ where: { userId: ids(n).user } }),
      period: await testPrisma.periodLog.count({ where: { profileId: ids(n).profile } }),
      symptom: await testPrisma.symptomLog.count({ where: { profileId: ids(n).profile } }),
      feedback: await testPrisma.feedback.count({ where: { userId: ids(n).user } }),
      sub: await testPrisma.subscription.count({ where: { userId: ids(n).user } }),
    })
    expect(await count('1')).toEqual({ user: 0, profile: 0, period: 0, symptom: 0, feedback: 0, sub: 0 })
    expect(await count('2')).toEqual({ user: 1, profile: 1, period: 1, symptom: 1, feedback: 1, sub: 1 })
    expect(await count('3')).toMatchObject({ user: 1 })

    const purgeLines = translog.mock.calls.filter(([event]) => event === 'account.purge')
    expect(purgeLines.filter(([, , extra]) => extra?.userId === ids('1').user)).toHaveLength(1)
    expect(purgeLines.filter(([, , extra]) => extra?.userId === ids('2').user)).toHaveLength(0)
  })
})
