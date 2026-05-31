import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { requireAdminUser } from './auth-queries'
import { listArticles, getArticleById, listCategories } from '@vesta/shared/server/services'
import { adminCacheTags, ADMIN_CACHE_TTL } from '@/lib/admin-cache-tags'

function articlesCacheKey(params: {
  page?: number
  pageSize?: number
  status?: string
  categoryId?: string
}) {
  return [
    'admin-articles',
    String(params.page ?? 1),
    String(params.pageSize ?? 20),
    params.status ?? '',
    params.categoryId ?? '',
  ]
}

export const getArticles = cache(async (params: {
  page?: number
  pageSize?: number
  status?: string
  categoryId?: string
} = {}) => {
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
