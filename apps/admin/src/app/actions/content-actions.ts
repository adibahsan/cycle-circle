'use server'

import { requireAdminAuth, getAuthUser } from '@vesta/shared/server/auth'
import {
  createArticle as svcCreateArticle,
  updateArticle as svcUpdateArticle,
  removeArticle,
  createCategory as svcCreateCategory,
  updateCategory as svcUpdateCategory,
  removeCategory,
  reorderCategories as svcReorderCategories,
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

  const article = await svcCreateArticle(admin.id, data, new Date())

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

  const article = await svcUpdateArticle(id, data, new Date())

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

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback
}

// Category actions return { error } instead of throwing: messages thrown from a server
// action are stripped in production, so the admin would never see why it failed.
export async function createCategory(name: string, nameBn?: string | null) {
  const jwt = await requireAdminAuth()
  try {
    const admin = await getAuthUser(jwt.sub)
    const category = await svcCreateCategory(admin.id, name, nameBn)
    revalidateContentTags()
    await revalidateWebTags(['articles'])
    return { category }
  } catch (e) {
    return { error: errorMessage(e, 'Failed to create category') }
  }
}

export async function updateCategory(id: string, name: string, nameBn?: string | null) {
  const jwt = await requireAdminAuth()
  try {
    const admin = await getAuthUser(jwt.sub)
    const category = await svcUpdateCategory(admin.id, id, name, nameBn)
    revalidateContentTags()
    await revalidateWebTags(['articles'])
    return { category }
  } catch (e) {
    return { error: errorMessage(e, 'Failed to rename category') }
  }
}

export async function deleteCategory(id: string) {
  const jwt = await requireAdminAuth()
  try {
    const admin = await getAuthUser(jwt.sub)
    await removeCategory(admin.id, id)
    revalidateContentTags()
    await revalidateWebTags(['articles'])
    return { success: true as const }
  } catch (e) {
    return { error: errorMessage(e, 'Failed to delete category') }
  }
}

export async function reorderCategories(orderedIds: string[]) {
  const jwt = await requireAdminAuth()
  try {
    const admin = await getAuthUser(jwt.sub)
    await svcReorderCategories(admin.id, orderedIds)
    revalidateContentTags()
    await revalidateWebTags(['articles'])
    return { success: true as const }
  } catch (e) {
    return { error: errorMessage(e, 'Failed to reorder categories') }
  }
}
