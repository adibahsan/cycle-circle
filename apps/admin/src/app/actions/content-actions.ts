'use server'

import { requireAdminAuth, getAuthUser } from '@vesta/shared/server/auth'
import {
  createArticle as svcCreateArticle,
  updateArticle as svcUpdateArticle,
  removeArticle,
  createCategory as svcCreateCategory,
  updateCategory as svcUpdateCategory,
  removeCategory,
} from '@vesta/shared/server/services'
import { revalidateTag } from 'next/cache'
import { adminCacheTags } from '@/lib/admin-cache-tags'
import { revalidateWebTags } from '@/lib/revalidate-web'

function revalidateContentTags(articleId?: string) {
  revalidateTag(adminCacheTags.content, { expire: 0 })
  if (articleId) {
    revalidateTag(adminCacheTags.article(articleId), { expire: 0 })
  }
}

export async function createArticle(data: {
  titleEn: string
  titleBn?: string | null
  bodyEn: string
  bodyBn?: string | null
  categoryId?: string | null
  cyclePhases?: string[]
  status?: string
}) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  const article = await svcCreateArticle(admin.id, data)

  revalidateContentTags()
  const webCacheRefreshed = await revalidateWebTags(['articles'])
  return { article, webCacheRefreshed }
}

export async function updateArticle(
  id: string,
  data: {
    titleEn?: string
    titleBn?: string | null
    bodyEn?: string
    bodyBn?: string | null
    categoryId?: string | null
    cyclePhases?: string[]
    status?: string
  }
) {
  await requireAdminAuth()

  const article = await svcUpdateArticle(id, data)

  revalidateContentTags(id)
  const webCacheRefreshed = await revalidateWebTags(['articles'])
  return { article, webCacheRefreshed }
}

export async function deleteArticle(id: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  await removeArticle(id, admin.id)

  revalidateContentTags(id)
  await revalidateWebTags(['articles'])
  return { success: true }
}

export async function createCategory(name: string) {
  await requireAdminAuth()

  const category = await svcCreateCategory(name)

  revalidateContentTags()
  return category
}

export async function updateCategory(id: string, name: string) {
  await requireAdminAuth()

  const category = await svcUpdateCategory(id, name)

  revalidateContentTags()
  await revalidateWebTags(['articles'])
  return category
}

export async function deleteCategory(id: string) {
  await requireAdminAuth()

  await removeCategory(id)

  revalidateContentTags()
  await revalidateWebTags(['articles'])
  return { success: true }
}
