import { prisma } from '../db'

// ── Utilities ──────────────────────────────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ── Article queries ────────────────────────────────────────────────────────────

export async function listArticles(
  params: {
    page?: number
    pageSize?: number
    status?: string
    categoryId?: string
  } = {},
) {
  const { page = 1, pageSize = 20, status, categoryId } = params
  const where: Record<string, unknown> = {}
  if (status && status !== 'all') where.status = status
  if (categoryId && categoryId !== 'all') where.categoryId = categoryId

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      include: {
        category: { select: { name: true } },
        author: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.article.count({ where }),
  ])

  return {
    articles,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function getArticleById(id: string) {
  return prisma.article.findUnique({
    where: { id },
    include: {
      category: true,
      author: { select: { fullName: true } },
    },
  })
}

export async function listCategories() {
  return prisma.articleCategory.findMany({
    include: { _count: { select: { articles: true } } },
    orderBy: { name: 'asc' },
  })
}

// ── Article mutations ──────────────────────────────────────────────────────────

export async function createArticle(
  authorId: string,
  data: {
    titleEn: string
    titleBn?: string
    bodyEn: string
    bodyBn?: string
    categoryId?: string
    cyclePhases?: string[]
    status?: string
  },
) {
  const slug = slugify(data.titleEn) + '-' + Date.now().toString(36)

  const article = await prisma.article.create({
    data: {
      slug,
      titleEn: data.titleEn,
      titleBn: data.titleBn || null,
      bodyEn: data.bodyEn,
      bodyBn: data.bodyBn || null,
      categoryId: data.categoryId || null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cyclePhases: (data.cyclePhases as never) || [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: (data.status as never) || 'DRAFT',
      authorId,
      publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
    },
  })

  await prisma.adminAuditLog.create({
    data: {
      adminId: authorId,
      action: 'ARTICLE_CREATED',
      targetType: 'Article',
      targetId: article.id,
    },
  })

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
  },
) {
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

  return prisma.article.update({
    where: { id },
    data: updateData,
  })
}

export async function removeArticle(id: string, adminId: string) {
  await prisma.article.delete({ where: { id } })

  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: 'ARTICLE_DELETED',
      targetType: 'Article',
      targetId: id,
    },
  })

  return { success: true }
}

// ── Category mutations ─────────────────────────────────────────────────────────

export async function createCategory(name: string) {
  const slug = slugify(name)
  return prisma.articleCategory.create({ data: { name, slug } })
}

export async function removeCategory(id: string) {
  const count = await prisma.article.count({ where: { categoryId: id } })
  if (count > 0) throw new Error('Cannot delete category with articles')
  await prisma.articleCategory.delete({ where: { id } })
  return { success: true }
}

// ── Web app: published articles ────────────────────────────────────────────────

export async function listPublishedArticles(
  params: {
    page?: number
    pageSize?: number
    phase?: string
  } = {},
) {
  const { page = 1, pageSize = 20, phase } = params
  const where: Record<string, unknown> = { status: 'PUBLISHED' }
  if (phase && phase !== 'all') {
    where.cyclePhases = { has: phase }
  }

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      include: {
        category: { select: { name: true } },
        author: { select: { fullName: true } },
      },
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.article.count({ where }),
  ])

  return {
    articles,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}
