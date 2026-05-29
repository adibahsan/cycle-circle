import { cache } from 'react'
import { requireCurrentUser } from './auth-queries'
import { getSymptomLogs as svcGetSymptomLogs } from '@vesta/shared/server/services'

export const getSymptomLogs = cache(async (profileId: string, date?: string) => {
  const user = await requireCurrentUser()
  return svcGetSymptomLogs(profileId, user.id, date)
})
