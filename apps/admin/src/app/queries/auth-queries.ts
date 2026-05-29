import { cache } from 'react'
import { verifyAuth, getAuthUser } from '@vesta/shared/server/auth'
import type { AuthUser } from '@vesta/shared/server/auth'

export const getCurrentAdminUser = cache(async (): Promise<AuthUser | null> => {
  const jwt = await verifyAuth()
  if (!jwt || jwt.role !== 'ADMIN') return null
  try {
    return await getAuthUser(jwt.sub)
  } catch {
    return null
  }
})

export const requireAdminUser = cache(async (): Promise<AuthUser> => {
  const user = await getCurrentAdminUser()
  if (!user) throw new Error('Unauthorized')
  return user
})
