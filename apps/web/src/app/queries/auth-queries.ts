import { cache } from 'react'
import { verifyAuth, getAuthUser } from '@vesta/shared/server/auth'
import type { AuthUser } from '@vesta/shared/server/auth'

export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const jwt = await verifyAuth()
  if (!jwt) return null
  try {
    return await getAuthUser(jwt.sub)
  } catch {
    return null
  }
})

export const requireCurrentUser = cache(async (): Promise<AuthUser> => {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  return user
})
