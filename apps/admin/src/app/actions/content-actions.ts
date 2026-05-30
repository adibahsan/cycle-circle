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
import { revalidatePath } from 'next/cache'

export async function createArticle(data: {
  titleEn: string
  titleBn?: string
  bodyEn: string
  bodyBn?: string
  categoryId?: string
  cyclePhases?: string[]
  status?: string
}) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  const article = await svcCreateArticle(admin.id, data)

  revalidatePath('/content')
  return article
}

export async function updateArticle(
  id: string,
  data: {
    titleEn?: string
    titleBn?: string
    bodyEn?: string
    bodyBn?: string
    categoryId?: string
    cyclePhases?: string[]
    status?: string
  }
) {
  await requireAdminAuth()

  const article = await svcUpdateArticle(id, data)

  revalidatePath('/content')
  revalidatePath(`/content/${id}`)
  return article
}

export async function deleteArticle(id: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  await removeArticle(id, admin.id)

  revalidatePath('/content')
  return { success: true }
}

export async function createCategory(name: string) {
  await requireAdminAuth()

  const category = await svcCreateCategory(name)

  revalidatePath('/content')
  return category
}

export async function updateCategory(id: string, name: string) {
  await requireAdminAuth()

  const category = await svcUpdateCategory(id, name)

  revalidatePath('/content')
  return category
}

export async function deleteCategory(id: string) {
  await requireAdminAuth()

  await removeCategory(id)

  revalidatePath('/content')
  return { success: true }
}
