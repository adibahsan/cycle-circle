import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { requireCurrentUser } from './auth-queries'
import { cacheTags, WEB_CACHE_TTL } from '@/lib/cache-tags'
import {
  getCycleLengthTrend as svcGetCycleLengthTrend,
  getSymptomFrequency as svcGetSymptomFrequency,
  getPeriodRegularity as svcGetPeriodRegularity,
  getFertileWindowHistory as svcGetFertileWindowHistory,
} from '@vesta/shared/server/services'

export type {
  CycleLengthPoint,
  SymptomFrequencyPoint,
  PeriodRegularity,
  FertileWindowPoint,
} from '@vesta/shared/server/services'

export const getCycleLengthTrend = cache(async (profileId: string) => {
  const user = await requireCurrentUser()
  return unstable_cache(
    () => svcGetCycleLengthTrend(profileId, user.id),
    ['insights-cycle-length', profileId],
    { tags: [cacheTags.tracking(profileId)], revalidate: WEB_CACHE_TTL }
  )()
})

export const getSymptomFrequency = cache(async (profileId: string) => {
  const user = await requireCurrentUser()
  return unstable_cache(
    () => svcGetSymptomFrequency(profileId, user.id),
    ['insights-symptom-frequency', profileId],
    { tags: [cacheTags.tracking(profileId)], revalidate: WEB_CACHE_TTL }
  )()
})

export const getPeriodRegularity = cache(async (profileId: string) => {
  const user = await requireCurrentUser()
  return unstable_cache(
    () => svcGetPeriodRegularity(profileId, user.id),
    ['insights-period-regularity', profileId],
    { tags: [cacheTags.tracking(profileId)], revalidate: WEB_CACHE_TTL }
  )()
})

export const getFertileWindowHistory = cache(async (profileId: string) => {
  const user = await requireCurrentUser()
  return unstable_cache(
    () => svcGetFertileWindowHistory(profileId, user.id),
    ['insights-fertile-window', profileId],
    { tags: [cacheTags.tracking(profileId)], revalidate: WEB_CACHE_TTL }
  )()
})
