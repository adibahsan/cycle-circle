import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { listPublishedArticles } from '@vesta/shared/server/services'
import { requireCurrentUser } from './auth-queries'

export const getPublishedArticles = cache(async (phase?: string) => {
  await requireCurrentUser()
  return unstable_cache(
    () => listPublishedArticles({ phase, pageSize: 50 }),
    ['articles', phase ?? 'all'],
    { tags: ['articles'], revalidate: 300 }
  )()
})
