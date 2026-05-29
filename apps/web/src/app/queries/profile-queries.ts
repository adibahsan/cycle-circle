import { cache } from 'react'
import { requireCurrentUser } from './auth-queries'
import { listProfiles, getProfileById } from '@vesta/shared/server/services'

export const getProfiles = cache(async () => {
  const user = await requireCurrentUser()
  return listProfiles(user.id)
})

export const getProfile = cache(async (profileId: string) => {
  const user = await requireCurrentUser()
  try {
    return await getProfileById(profileId, user.id)
  } catch {
    return null
  }
})
