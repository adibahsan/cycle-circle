import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { listPublishedArticles } from '@vesta/shared/server/services'
import { requireCurrentUser } from './auth-queries'
import { cacheTags, WEB_CACHE_TTL } from '@/lib/cache-tags'

export const getPublishedArticles = cache(async (phase?: string) => {
  await requireCurrentUser()
  return unstable_cache(
    () => listPublishedArticles({ phase, pageSize: 50 }),
    ['articles', phase ?? 'all'],
    { tags: [cacheTags.articles], revalidate: WEB_CACHE_TTL }
  )()
})
