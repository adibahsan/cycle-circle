import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { requireCurrentUser } from './auth-queries'
import { getSymptomLogs as svcGetSymptomLogs } from '@vesta/shared/server/services'
import { cacheTags, WEB_CACHE_TTL } from '@/lib/cache-tags'

export const getSymptomLogs = cache(async (profileId: string, date?: string) => {
  const user = await requireCurrentUser()
  return unstable_cache(
    () => svcGetSymptomLogs(profileId, user.id, date),
    ['symptoms', profileId, date ?? 'all'],
    { tags: [cacheTags.symptoms(profileId)], revalidate: WEB_CACHE_TTL }
  )()
})
