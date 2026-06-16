import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { requireAdminUser } from './auth-queries'
import {
  getCycleLengthDistribution as svcGetCycleLengthDistribution,
  getSymptomsByCategory as svcGetSymptomsByCategory,
  getPredictionAccuracy as svcGetPredictionAccuracy,
  getUserRetention as svcGetUserRetention,
  getUserTrend as svcGetUserTrend,
} from '@vesta/shared/server/services'
import { adminCacheTags, ADMIN_CACHE_TTL } from '@/lib/admin-cache-tags'

export const getCycleLengthDistribution = cache(async () => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetCycleLengthDistribution(),
    ['admin-cycle-length-distribution'],
    { tags: [adminCacheTags.analytics], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getSymptomsByCategory = cache(async () => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetSymptomsByCategory(),
    ['admin-symptoms-by-category'],
    { tags: [adminCacheTags.analytics], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getPredictionAccuracy = cache(async () => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetPredictionAccuracy(),
    ['admin-prediction-accuracy'],
    { tags: [adminCacheTags.analytics], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getUserRetention = cache(async () => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetUserRetention(),
    ['admin-user-retention'],
    { tags: [adminCacheTags.analytics], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getUserTrend = cache(async (days: number) => {
  await requireAdminUser()
  return unstable_cache(
    () => svcGetUserTrend({ days }),
    ['admin-user-trend', String(days)],
    { tags: [adminCacheTags.analytics], revalidate: ADMIN_CACHE_TTL }
  )()
})
