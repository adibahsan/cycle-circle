import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { requireAdminUser } from './auth-queries'
import {
  getCycleLengthDistribution as svcGetCycleLengthDistribution,
  getSymptomsByCategory as svcGetSymptomsByCategory,
  getPredictionAccuracy as svcGetPredictionAccuracy,
  getUserRetention as svcGetUserRetention,
  getUserTrend as svcGetUserTrend,
  getDailyActiveLoggers as svcGetDailyActiveLoggers,
  getSymptomLoggingRate as svcGetSymptomLoggingRate,
  getLoggingStreakDistribution as svcGetLoggingStreakDistribution,
  getLoggingRetention as svcGetLoggingRetention,
  getLatestPredictionMae as svcGetLatestPredictionMae,
  getPredictionMaeTrend as svcGetPredictionMaeTrend,
  getSymptomsByPhase as svcGetSymptomsByPhase,
  type AnalyticsRange,
} from '@vesta/shared/server/services'
import { adminCacheTags, ADMIN_CACHE_TTL } from '@/lib/admin-cache-tags'

/** Stable cache key part: UTC day, so a moving `to` doesn't bust the cache every call. */
const day = (d: Date) => d.toISOString().split('T')[0]

export const getCycleLengthDistribution = cache(async (range: AnalyticsRange) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetCycleLengthDistribution(range),
    ['admin-cycle-length-distribution', day(range.from), day(range.to)],
    { tags: [adminCacheTags.analytics], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getSymptomsByCategory = cache(async (range: AnalyticsRange) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetSymptomsByCategory(range),
    ['admin-symptoms-by-category', day(range.from), day(range.to)],
    { tags: [adminCacheTags.analytics], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getPredictionAccuracy = cache(async (range: AnalyticsRange) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetPredictionAccuracy(range),
    ['admin-prediction-accuracy', day(range.from), day(range.to)],
    { tags: [adminCacheTags.analytics], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getUserRetention = cache(async (range: AnalyticsRange) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetUserRetention(range),
    ['admin-user-retention', day(range.from), day(range.to)],
    { tags: [adminCacheTags.analytics], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getUserTrend = cache(async (days: number) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetUserTrend({ days }),
    ['admin-analytics-user-trend', String(days)],
    { tags: [adminCacheTags.analytics], revalidate: ADMIN_CACHE_TTL }
  )()
})

export type TrendMetric = 'signups' | 'active' | 'logRate'

/** Sign-ups / daily active loggers / share of profiles logging, over the last `days`. */
export const getTrendMetric = cache(async (metric: TrendMetric, days: number) => {
  await requireAdminUser()
  return unstable_cache(
    async (): Promise<{ date: string; value: number }[]> => {
      if (metric === 'active') {
        return (await svcGetDailyActiveLoggers({ days })).map((r) => ({ date: r.date, value: r.count }))
      }
      if (metric === 'logRate') {
        return (await svcGetSymptomLoggingRate({ days })).map((r) => ({ date: r.date, value: r.rate }))
      }
      return (await svcGetUserTrend({ days })).map((r) => ({ date: r.date, value: r.count }))
    },
    ['admin-analytics-trend-metric', metric, String(days)],
    { tags: [adminCacheTags.analytics], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getDailyActiveLoggers = cache(async (days: number) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetDailyActiveLoggers({ days }),
    ['admin-daily-active-loggers', String(days)],
    { tags: [adminCacheTags.analytics], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getSymptomLoggingRate = cache(async (days: number) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetSymptomLoggingRate({ days }),
    ['admin-symptom-logging-rate', String(days)],
    { tags: [adminCacheTags.analytics], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getLoggingStreakDistribution = cache(async () => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetLoggingStreakDistribution(),
    ['admin-logging-streak-distribution'],
    { tags: [adminCacheTags.analytics], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getLoggingRetention = cache(async (weeks?: number) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetLoggingRetention(weeks),
    ['admin-logging-retention', String(weeks ?? 8)],
    { tags: [adminCacheTags.analytics], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getPredictionMae = cache(async () => {
  await requireAdminUser()
  return unstable_cache(
    async () => (await svcGetLatestPredictionMae()).tiers,
    ['admin-prediction-mae'],
    { tags: [adminCacheTags.analytics], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getPredictionMaeTrend = cache(async (range: AnalyticsRange) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetPredictionMaeTrend(range),
    ['admin-prediction-mae-trend', day(range.from), day(range.to)],
    { tags: [adminCacheTags.analytics], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getSymptomsByPhase = cache(async (range: AnalyticsRange) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetSymptomsByPhase(range),
    ['admin-symptoms-by-phase', day(range.from), day(range.to)],
    { tags: [adminCacheTags.analytics], revalidate: ADMIN_CACHE_TTL }
  )()
})
