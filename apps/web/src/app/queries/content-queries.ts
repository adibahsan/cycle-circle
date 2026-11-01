import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { getPublishedArticleById, listPublishedArticles, listPublishedCategories, sanitizeArticleHtml } from '@vesta/shared/server/services'
import { requireCurrentUser } from './auth-queries'
import { ARTICLES_CACHE_TTL, cacheTags } from '@/lib/cache-tags'

export const getPublishedArticles = cache(async (phase?: string) => {
  await requireCurrentUser()
  return unstable_cache(
    () => listPublishedArticles({ phase, pageSize: 50 }, new Date()),
    ['articles', phase ?? 'all'],
    { tags: [cacheTags.articles], revalidate: ARTICLES_CACHE_TTL }
  )()
})

/** Learn-page category chips, in the order the admin set. */
export const getPublishedCategories = cache(async () => {
  await requireCurrentUser()
  return unstable_cache(() => listPublishedCategories(new Date()), ['article-categories'], {
    tags: [cacheTags.articles],
    revalidate: ARTICLES_CACHE_TTL,
  })()
})

/**
 * One published article for the reader at `/content/[id]`, read live (an unpublish
 * takes effect at once). Bodies are sanitised again here, before they reach
 * `dangerouslySetInnerHTML`, so the reader never trusts stored HTML on its own.
 * Returns null for an unknown, draft, archived or not-yet-scheduled id.
 */
export const getPublishedArticle = cache(async (id: string) => {
  await requireCurrentUser()
  const article = await getPublishedArticleById(id, new Date())
  if (!article) return null
  return {
    ...article,
    bodyEn: sanitizeArticleHtml(article.bodyEn),
    bodyBn: article.bodyBn ? sanitizeArticleHtml(article.bodyBn) : null,
  }
})

export type ReaderArticle = NonNullable<Awaited<ReturnType<typeof getPublishedArticle>>>
