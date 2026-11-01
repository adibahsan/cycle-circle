import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { requireAdminUser } from './auth-queries'
import {
  listArticles,
  getArticleById,
  listCategories,
  getContentStatusBreakdown,
  getContentByCategory,
  getContentByPhase,
} from '@vesta/shared/server/services'
import { normalizeListOptions, type ListArticlesOptions } from '@vesta/shared/utils/article-list-params'
import { adminCacheTags, ADMIN_CACHE_TTL } from '@/lib/admin-cache-tags'

function articlesCacheKey(o: ListArticlesOptions) {
  // Normalised so equivalent URLs share a cache entry; every option that changes the rows is in the key.
  const n = normalizeListOptions(o)
  return [
    'admin-articles',
    String(n.page),
    String(n.pageSize),
    n.status ?? '',
    n.categoryId ?? '',
    n.phase ?? '',
    n.missingBangla ? '1' : '',
    n.sort,
    n.q ?? '',
  ]
}

export const getArticles = cache(async (params: ListArticlesOptions = {}) => {
  await requireAdminUser()
  return unstable_cache(
    () => listArticles(params),
    articlesCacheKey(params),
    { tags: [adminCacheTags.content], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getArticle = cache(async (id: string) => {
  await requireAdminUser()
  return unstable_cache(
    () => getArticleById(id),
    ['admin-article', id],
    { tags: [adminCacheTags.article(id), adminCacheTags.content], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getCategories = cache(async () => {
  await requireAdminUser()
  return unstable_cache(
    () => listCategories(),
    ['admin-categories'],
    { tags: [adminCacheTags.content], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getContentStatusBreakdownQuery = cache(async () => {
  await requireAdminUser()
  return unstable_cache(
    () => getContentStatusBreakdown(),
    ['admin-content-status-breakdown'],
    { tags: [adminCacheTags.content], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getContentByCategoryQuery = cache(async () => {
  await requireAdminUser()
  return unstable_cache(
    () => getContentByCategory(),
    ['admin-content-by-category'],
    { tags: [adminCacheTags.content], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getContentByPhaseQuery = cache(async () => {
  await requireAdminUser()
  return unstable_cache(
    () => getContentByPhase(),
    ['admin-content-by-phase'],
    { tags: [adminCacheTags.content], revalidate: ADMIN_CACHE_TTL }
  )()
})
