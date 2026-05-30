import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { verifyAuth, getAuthUser } from '@vesta/shared/server/auth'
import type { AuthUser } from '@vesta/shared/server/auth'
import { adminCacheTags, ADMIN_CACHE_TTL } from '@/lib/admin-cache-tags'

export const getCurrentAdminUser = cache(async (): Promise<AuthUser | null> => {
  const jwt = await verifyAuth()
  if (!jwt || jwt.role !== 'ADMIN') return null
  try {
    return await unstable_cache(
      () => getAuthUser(jwt.sub),
      ['admin-user', jwt.sub],
      { tags: [adminCacheTags.auth(jwt.sub)], revalidate: ADMIN_CACHE_TTL }
    )()
  } catch {
    return null
  }
})

export const requireAdminUser = cache(async (): Promise<AuthUser> => {
  const user = await getCurrentAdminUser()
  if (!user) throw new Error('Unauthorized')
  return user
})
