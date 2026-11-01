'use server'

import { requireAdminAuth, getAuthUser } from '@vesta/shared/server/auth'
import {
  createArticle as svcCreateArticle,
  updateArticle as svcUpdateArticle,
  removeArticle,
  bulkArticleAction as svcBulkArticleAction,
  type BulkArticleAction,
  type BulkArticleResult,
  createCategory as svcCreateCategory,
  updateCategory as svcUpdateCategory,
  removeCategory,
  contentErrorMessage,
  ContentError,
  reorderCategories as svcReorderCategories,
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

/** Publish time arrives as an ISO string (server actions); an unparseable one is a validation error. */
function parsePublishAt(v: string | null | undefined): Date | null | undefined {
  if (v === undefined || v === null) return v
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) throw new ContentError('Choose a valid publish date and time.')
  return d
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
  /** ISO instant to go live at (future = scheduled). */
  publishedAt?: string | null
}) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  return guarded(async () => {
    const article = await svcCreateArticle(admin.id, { ...data, publishedAt: parsePublishAt(data.publishedAt) }, new Date())

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
    /** ISO instant: schedule. null: publish now. Omitted: unchanged. */
    publishedAt?: string | null
  }
) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  return guarded(async () => {
    const article = await svcUpdateArticle(id, { ...data, publishedAt: parsePublishAt(data.publishedAt) }, new Date(), admin.id)

    revalidateContentTags(id)
    const webCacheRefreshed = await revalidateWebTags(['articles'])
    return { article, webCacheRefreshed }
  })
}

export async function bulkArticleAction(
  ids: string[],
  action: BulkArticleAction,
): Promise<BulkArticleResult | ActionError> {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  return guarded(async () => {
    const result = await svcBulkArticleAction(admin.id, ids, action, new Date())

    revalidateContentTags()
    await revalidateWebTags(['articles'])
    return result
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
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  return guarded(async () => {
    const category = await svcCreateCategory(admin.id, name, nameBn)
    revalidateContentTags()
    await revalidateWebTags(['articles'])
    return { category }
  })
}

export async function updateCategory(id: string, name: string, nameBn?: string | null) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  return guarded(async () => {
    const category = await svcUpdateCategory(admin.id, id, name, nameBn)
    revalidateContentTags()
    await revalidateWebTags(['articles'])
    return { category }
  })
}

export async function deleteCategory(id: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  return guarded(async () => {
    await removeCategory(admin.id, id)
    revalidateContentTags()
    await revalidateWebTags(['articles'])
    return { success: true as const }
  })
}

export async function reorderCategories(orderedIds: string[]) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  return guarded(async () => {
    await svcReorderCategories(admin.id, orderedIds)
    revalidateContentTags()
    await revalidateWebTags(['articles'])
    return { success: true as const }
  })
}
