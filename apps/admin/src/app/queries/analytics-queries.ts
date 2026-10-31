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
  getDailyActiveUsers as svcGetDailyActiveUsers,
  getSymptomLoggingRate as svcGetSymptomLoggingRate,
  getLoggingStreakDistribution as svcGetLoggingStreakDistribution,
  getLoggingRetention as svcGetLoggingRetention,
  getLatestPredictionMae as svcGetLatestPredictionMae,
  getPredictionMaeTrend as svcGetPredictionMaeTrend,
  getSymptomsByPhase as svcGetSymptomsByPhase,
} from '@vesta/shared/server/services'
import type { DateRange } from '@vesta/shared/utils/date-range'
import { adminCacheTags, KPI_CACHE_TTL } from '@/lib/admin-cache-tags'


export const getCycleLengthDistribution = cache(async (range: DateRange) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetCycleLengthDistribution(range),
    ['admin-cycle-length-distribution', range.key],
    { tags: [adminCacheTags.analytics], revalidate: KPI_CACHE_TTL }
  )()
})

export const getSymptomsByCategory = cache(async (range: DateRange) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetSymptomsByCategory(range),
    ['admin-symptoms-by-category', range.key],
    { tags: [adminCacheTags.analytics], revalidate: KPI_CACHE_TTL }
  )()
})

export const getPredictionAccuracy = cache(async (range: DateRange) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetPredictionAccuracy(range),
    ['admin-prediction-accuracy', range.key],
    { tags: [adminCacheTags.analytics], revalidate: KPI_CACHE_TTL }
  )()
})

export const getUserRetention = cache(async (range: DateRange) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetUserRetention(range, { now: new Date() }),
    ['admin-user-retention', range.key],
    { tags: [adminCacheTags.analytics], revalidate: KPI_CACHE_TTL }
  )()
})

export const getUserTrend = cache(async (range: DateRange) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetUserTrend(range, new Date()),
    ['admin-analytics-user-trend', range.key],
    { tags: [adminCacheTags.analytics], revalidate: KPI_CACHE_TTL }
  )()
})

export type TrendMetric = 'signups' | 'active' | 'logRate'

/** Sign-ups / daily active loggers / share of profiles logging, over the selected range. */
export const getTrendMetric = cache(async (metric: TrendMetric, range: DateRange) => {
  await requireAdminUser()
  return unstable_cache(
    async (): Promise<{ date: string; value: number }[]> => {
      if (metric === 'active') {
        return (await svcGetDailyActiveLoggers(range, new Date())).map((r) => ({ date: r.date, value: r.count }))
      }
      if (metric === 'logRate') {
        return (await svcGetSymptomLoggingRate(range, new Date())).map((r) => ({ date: r.date, value: r.rate }))
      }
      return (await svcGetUserTrend(range, new Date())).map((r) => ({ date: r.date, value: r.count }))
    },
    ['admin-analytics-trend-metric', metric, range.key],
    { tags: [adminCacheTags.analytics], revalidate: KPI_CACHE_TTL }
  )()
})

export const getDailyActiveLoggers = cache(async (range: DateRange) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetDailyActiveLoggers(range, new Date()),
    ['admin-daily-active-loggers', range.key],
    { tags: [adminCacheTags.analytics], revalidate: KPI_CACHE_TTL }
  )()
})

export const getDailyActiveUsers = cache(async (range: DateRange) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetDailyActiveUsers(range, new Date()),
    ['admin-daily-active-users', range.key],
    { tags: [adminCacheTags.analytics], revalidate: KPI_CACHE_TTL }
  )()
})

export const getSymptomLoggingRate = cache(async (range: DateRange) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetSymptomLoggingRate(range, new Date()),
    ['admin-symptom-logging-rate', range.key],
    { tags: [adminCacheTags.analytics], revalidate: KPI_CACHE_TTL }
  )()
})

export const getLoggingStreakDistribution = cache(async (range: DateRange) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetLoggingStreakDistribution(range, new Date()),
    ['admin-logging-streak-distribution', range.key],
    { tags: [adminCacheTags.analytics], revalidate: KPI_CACHE_TTL }
  )()
})

export const getLoggingRetention = cache(async (range: DateRange) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetLoggingRetention(range, new Date()),
    ['admin-logging-retention', range.key],
    { tags: [adminCacheTags.analytics], revalidate: KPI_CACHE_TTL }
  )()
})

export const getPredictionMae = cache(async () => {
  await requireAdminUser()
  return unstable_cache(
    async () => (await svcGetLatestPredictionMae()).tiers,
    ['admin-prediction-mae'],
    { tags: [adminCacheTags.analytics], revalidate: KPI_CACHE_TTL }
  )()
})

export const getPredictionMaeTrend = cache(async (range: DateRange) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetPredictionMaeTrend(range),
    ['admin-prediction-mae-trend', range.key],
    { tags: [adminCacheTags.analytics], revalidate: KPI_CACHE_TTL }
  )()
})

export const getSymptomsByPhase = cache(async (range: DateRange) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetSymptomsByPhase(range),
    ['admin-symptoms-by-phase', range.key],
    { tags: [adminCacheTags.analytics], revalidate: KPI_CACHE_TTL }
  )()
})
