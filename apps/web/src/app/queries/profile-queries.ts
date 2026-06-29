import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { requireCurrentUser } from './auth-queries'
import { listProfiles } from '@vesta/shared/server/services'
import { cookies } from 'next/headers'
import { cacheTags, WEB_CACHE_TTL } from '@/lib/cache-tags'

export const getProfiles = cache(async () => {
  const user = await requireCurrentUser()
  return unstable_cache(
    () => listProfiles(user.id),
    ['profiles', user.id],
    { tags: [cacheTags.profiles(user.id)], revalidate: WEB_CACHE_TTL }
  )()
})

export async function getActiveProfileId(
  profiles: { id: string }[],
  searchParamsProfileId?: string
): Promise<string> {
  if (searchParamsProfileId && profiles.some(p => p.id === searchParamsProfileId)) {
    return searchParamsProfileId
  }
  const cookieStore = await cookies()
  const cookieProfileId = cookieStore.get('vesta_active_profile')?.value
  if (cookieProfileId && profiles.some(p => p.id === cookieProfileId)) {
    return cookieProfileId
  }
  return profiles[0].id
}
