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
  } else if (data.status === 'DRAFT' || data.status === 'ARCHIVED') {
    updateData.publishedAt = null
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

export async function updateCategory(id: string, name: string) {
  const slug = slugify(name)
  return prisma.articleCategory.update({ where: { id }, data: { name, slug } })
}

export async function removeCategory(id: string) {
  const count = await prisma.article.count({ where: { categoryId: id } })
  if (count > 0) throw new Error('Cannot delete category with articles')
  await prisma.articleCategory.delete({ where: { id } })
  return { success: true }
}

// ── Chart-data helpers ─────────────────────────────────────────────────────────

/**
 * Returns article counts grouped by status (DRAFT / PUBLISHED / ARCHIVED).
 * Status values correspond to the `ArticleStatus` enum.
 */
export async function getContentStatusBreakdown(): Promise<
  { status: string; count: number }[]
> {
  const groups = await prisma.article.groupBy({
    by: ['status'],
    _count: { status: true },
    orderBy: { status: 'asc' },
  })

  return groups.map((g) => ({ status: g.status, count: g._count.status }))
}

/**
 * Returns article counts grouped by category name.
 * Articles with no category are bucketed as "Uncategorised".
 */
export async function getContentByCategory(): Promise<
  { category: string; count: number }[]
> {
  const groups = await prisma.article.groupBy({
    by: ['categoryId'],
    _count: { categoryId: true },
    orderBy: { _count: { categoryId: 'desc' } },
  })

  if (groups.length === 0) return []

  // Resolve category names for the non-null IDs in one query
  const ids = groups
    .map((g) => g.categoryId)
    .filter((id): id is string => id !== null)

  const categories = await prisma.articleCategory.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  })

  const nameById = new Map(categories.map((c) => [c.id, c.name]))

  return groups.map((g) => ({
    category: g.categoryId ? (nameById.get(g.categoryId) ?? 'Uncategorised') : 'Uncategorised',
    count: g._count.categoryId,
  }))
}

/**
 * Returns article counts per cycle phase tag.
 * `cyclePhases` is a native PostgreSQL `CyclePhase[]` array column, so
 * Prisma does not expose a direct groupBy on array elements. We fetch only
 * the `cyclePhases` column and reduce in JS.
 *
 * All four phases are always present in the result even if count is 0:
 * MENSTRUAL | FOLLICULAR | OVULATION | LUTEAL.
 */
export async function getContentByPhase(): Promise<
  { phase: string; count: number }[]
> {
  const rows = await prisma.article.findMany({
    select: { cyclePhases: true },
  })

  const PHASES = ['MENSTRUAL', 'FOLLICULAR', 'OVULATION', 'LUTEAL'] as const
  const counts = new Map<string, number>(PHASES.map((p) => [p, 0]))

  for (const row of rows) {
    for (const phase of row.cyclePhases) {
      counts.set(phase, (counts.get(phase) ?? 0) + 1)
    }
  }

  return PHASES.map((phase) => ({ phase, count: counts.get(phase) ?? 0 }))
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
