import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { verifyAuth, getAuthUser } from '@vesta/shared/server/auth'
import type { AuthUser } from '@vesta/shared/server/auth'

export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const jwt = await verifyAuth()
  if (!jwt) return null
  try {
    return unstable_cache(
      () => getAuthUser(jwt.sub),
      ['user', jwt.sub],
      { tags: [`user:${jwt.sub}`], revalidate: 300 }
    )()
  } catch {
    return null
  }
})

export const requireCurrentUser = cache(async (): Promise<AuthUser> => {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  return user
})
