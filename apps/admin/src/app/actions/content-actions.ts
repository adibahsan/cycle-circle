'use server'

import { prisma } from '@vesta/shared'
import { requireAdminAuth, getAuthUser } from '@vesta/shared/server/auth'
import { revalidatePath } from 'next/cache'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

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

  const slug = slugify(data.titleEn) + '-' + Date.now().toString(36)

  const article = await prisma.article.create({
    data: {
      slug,
      titleEn: data.titleEn,
      titleBn: data.titleBn || null,
      bodyEn: data.bodyEn,
      bodyBn: data.bodyBn || null,
      categoryId: data.categoryId || null,
      cyclePhases: (data.cyclePhases as never) || [],
      status: (data.status as never) || 'DRAFT',
      authorId: admin.id,
      publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
    },
  })

  await prisma.adminAuditLog.create({
    data: {
      adminId: admin.id,
      action: 'ARTICLE_CREATED',
      targetType: 'Article',
      targetId: article.id,
    },
  })

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

  const updateData: Record<string, unknown> = { ...data }

  if (data.status === 'PUBLISHED') {
    const existing = await prisma.article.findUnique({ where: { id } })
    if (existing && !existing.publishedAt) {
      updateData.publishedAt = new Date()
    }
  }

  if (data.cyclePhases) {
    updateData.cyclePhases = data.cyclePhases
  }

  const article = await prisma.article.update({
    where: { id },
    data: updateData,
  })

  revalidatePath('/content')
  revalidatePath(`/content/${id}`)
  return article
}

export async function deleteArticle(id: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  await prisma.article.delete({ where: { id } })

  await prisma.adminAuditLog.create({
    data: {
      adminId: admin.id,
      action: 'ARTICLE_DELETED',
      targetType: 'Article',
      targetId: id,
    },
  })

  revalidatePath('/content')
  return { success: true }
}

export async function createCategory(name: string) {
  await requireAdminAuth()
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const category = await prisma.articleCategory.create({ data: { name, slug } })
  revalidatePath('/content')
  return category
}

export async function deleteCategory(id: string) {
  await requireAdminAuth()
  const count = await prisma.article.count({ where: { categoryId: id } })
  if (count > 0) throw new Error('Cannot delete category with articles')
  await prisma.articleCategory.delete({ where: { id } })
  revalidatePath('/content')
  return { success: true }
}
