import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { redirect } from 'next/navigation'
import { verifyAuth, getAuthUser } from '@vesta/shared/server/auth'
import type { AuthUser } from '@vesta/shared/server/auth'
import { cacheTags, WEB_CACHE_TTL } from '@/lib/cache-tags'

export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const jwt = await verifyAuth()
  if (!jwt) return null
  try {
    return await unstable_cache(
      () => getAuthUser(jwt.sub),
      ['user', jwt.sub],
      { tags: [cacheTags.user(jwt.sub)], revalidate: WEB_CACHE_TTL }
    )()
  } catch {
    return null
  }
})

export const requireCurrentUser = cache(async (): Promise<AuthUser> => {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
})
