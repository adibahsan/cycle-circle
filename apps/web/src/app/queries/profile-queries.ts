import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { requireCurrentUser } from './auth-queries'
import { listProfiles, getProfileById } from '@vesta/shared/server/services'

export const getProfiles = cache(async () => {
  const user = await requireCurrentUser()
  return unstable_cache(
    () => listProfiles(user.id),
    ['profiles', user.id],
    { tags: [`profiles:${user.id}`], revalidate: 300 }
  )()
})

export const getProfile = cache(async (profileId: string) => {
  const user = await requireCurrentUser()
  try {
    return unstable_cache(
      () => getProfileById(profileId, user.id),
      ['profile', profileId],
      { tags: [`profiles:${user.id}`], revalidate: 300 }
    )()
  } catch {
    return null
  }
})
