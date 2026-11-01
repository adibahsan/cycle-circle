'use server'

import { requireAdminAuth, getAuthUser } from '@vesta/shared/server/auth'
import {
  createArticle as svcCreateArticle,
  updateArticle as svcUpdateArticle,
  removeArticle,
  createCategory as svcCreateCategory,
  updateCategory as svcUpdateCategory,
  removeCategory,
  contentErrorMessage,
} from '@vesta/shared/server/services'
import { revalidateTag } from 'next/cache'
import { adminCacheTags } from '@/lib/admin-cache-tags'
import { revalidateWebTags } from '@/lib/revalidate-web'

/** Every content action returns its result or `{ error }`; it never throws a validation/DB failure. */
export type ActionError = { error: string }

async function guarded<T>(fn: () => Promise<T>): Promise<T | ActionError> {
  try {
    return await fn()
  } catch (err) {
    const error = contentErrorMessage(err)
    console.error('[content-actions]', err)
    return { error }
  }
}

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

  return guarded(async () => {
    const article = await svcCreateArticle(admin.id, data, new Date())

    revalidateContentTags()
    const webCacheRefreshed = await revalidateWebTags(['articles'])
    return { article, webCacheRefreshed }
  })
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

  return guarded(async () => {
    const article = await svcUpdateArticle(id, data, new Date())

    revalidateContentTags(id)
    const webCacheRefreshed = await revalidateWebTags(['articles'])
    return { article, webCacheRefreshed }
  })
}

export async function deleteArticle(id: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  return guarded(async () => {
    await removeArticle(id, admin.id)

    revalidateContentTags(id)
    await revalidateWebTags(['articles'])
    return { success: true as const }
  })
}

export async function createCategory(name: string, nameBn?: string | null) {
  await requireAdminAuth()

  return guarded(async () => {
    const category = await svcCreateCategory(name, nameBn)

    revalidateContentTags()
    return category
  })
}

export async function updateCategory(id: string, name: string, nameBn?: string | null) {
  await requireAdminAuth()

  return guarded(async () => {
    const category = await svcUpdateCategory(id, name, nameBn)

    revalidateContentTags()
    await revalidateWebTags(['articles'])
    return category
  })
}

export async function deleteCategory(id: string) {
  await requireAdminAuth()

  return guarded(async () => {
    await removeCategory(id)

    revalidateContentTags()
    await revalidateWebTags(['articles'])
    return { success: true as const }
  })
}
