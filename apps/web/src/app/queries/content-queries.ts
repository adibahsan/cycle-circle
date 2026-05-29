import { cache } from 'react'
import { listPublishedArticles } from '@vesta/shared/server/services'
import { requireCurrentUser } from './auth-queries'

export const getPublishedArticles = cache(async (phase?: string) => {
  await requireCurrentUser()
  return listPublishedArticles({ phase, pageSize: 50 })
})
