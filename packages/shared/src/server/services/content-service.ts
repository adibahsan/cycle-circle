import { AUDIT_ACTIONS } from './audit-actions'
import { createAuditLog } from './audit-service'
import { Prisma } from '@prisma/client'
import sanitizeHtml from 'sanitize-html'
import { prisma } from '../db'
import {
  ARTICLE_NO_CATEGORY,
  ARTICLE_PHASES,
  normalizeListOptions,
  type ListArticlesOptions,
} from '../../utils/article-list-params'
import { articlePublishWarnings, isBlankBody } from '../../utils/article-warnings'

// ── Utilities ──────────────────────────────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// Tiptap StarterKit produces a small, known set of tags. Allow those, drop
// everything else (script/style/iframe/event-handlers are stripped).
const UPLOAD_SRC_RE = /^\/uploads\/[A-Za-z0-9][A-Za-z0-9._-]*$/

const ARTICLE_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'code', 'pre',
    'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'span',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'title'],
    span: [],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
  },
  // Images may only come from our own uploads path (ADR: article images).
  exclusiveFilter: (frame) => frame.tag === 'img' && !UPLOAD_SRC_RE.test(frame.attribs.src ?? ''),
}

/** Sanitise rich-text article HTML before persistence (strips script/unsafe tags + event handlers). */
export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, ARTICLE_SANITIZE_OPTIONS)
}

// ── Article queries ────────────────────────────────────────────────────────────

export async function listArticles(options: ListArticlesOptions = {}) {
  const { q, status, categoryId, phase, missingBangla, sort, page, pageSize } = normalizeListOptions(options)

  const and: Prisma.ArticleWhereInput[] = []
  if (q) {
    // Prisma does not escape LIKE wildcards in `contains`; a typed % or _ must match literally.
    const needle = q.replace(/[\\%_]/g, '\\$&')
    and.push({
      OR: [
        { titleEn: { contains: needle, mode: 'insensitive' } },
        { titleBn: { contains: needle, mode: 'insensitive' } },
      ],
    })
  }
  if (status) and.push({ status })
  if (categoryId) and.push({ categoryId: categoryId === ARTICLE_NO_CATEGORY ? null : categoryId })
  if (phase) and.push({ cyclePhases: { has: phase } })
  // Blank bodies are stored as null (create/updateArticle normalise), so null covers them.
  if (missingBangla) and.push({ OR: [{ titleBn: null }, { titleBn: '' }, { bodyBn: null }, { bodyBn: '' }] })
  const where: Prisma.ArticleWhereInput = and.length ? { AND: and } : {}

  const orderBy: Prisma.ArticleOrderByWithRelationInput[] =
    sort === 'title' ? [{ titleEn: 'asc' }, { id: 'asc' }] : [{ createdAt: 'desc' }, { id: 'desc' }]

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      include: {
        category: { select: { name: true, nameBn: true } },
        author: { select: { fullName: true } },
      },
      orderBy,
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
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
}

/** Categories that have at least one published article, in admin order (Learn page filter chips). */
export async function listPublishedCategories() {
  return prisma.articleCategory.findMany({
    where: { articles: { some: { status: 'PUBLISHED' } } },
    select: { id: true, name: true, nameBn: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
}

// ── Article mutations ──────────────────────────────────────────────────────────

const ARTICLE_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const

function assertArticleStatus(status: string | undefined): void {
  if (status !== undefined && !(ARTICLE_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`Invalid article status "${status}". Expected one of ${ARTICLE_STATUSES.join(', ')}.`)
  }
}

export { articlePublishWarnings }

/** An error whose message is safe to show an admin as-is. */
export class ContentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContentError'
  }
}

const GENERIC_ERROR = 'Something went wrong. Please try again.'

/** Message an admin action should return for a thrown error (never leaks internals). */
export function contentErrorMessage(err: unknown): string {
  if (err instanceof ContentError) return err.message
  const code = (err as { code?: unknown } | null)?.code
  if (code === 'P2002') return 'That name is already in use.'
  if (code === 'P2025') return 'That item no longer exists.'
  return GENERIC_ERROR
}

async function assertArticleFields(
  data: { titleEn?: string; bodyEn?: string; categoryId?: string | null; cyclePhases?: string[] },
  mode: 'create' | 'update',
): Promise<void> {
  if ((mode === 'create' || data.titleEn !== undefined) && !data.titleEn?.trim()) {
    throw new ContentError('English title is required.')
  }
  if ((mode === 'create' || data.bodyEn !== undefined) && isBlankBody(data.bodyEn)) {
    throw new ContentError('English body is required.')
  }
  const bad = data.cyclePhases?.filter((p) => !(ARTICLE_PHASES as readonly string[]).includes(p))
  if (bad?.length) {
    throw new ContentError(`Invalid cycle phase "${bad[0]}". Expected one of ${ARTICLE_PHASES.join(', ')}.`)
  }
  if (data.categoryId) {
    const found = await prisma.articleCategory.findUnique({ where: { id: data.categoryId }, select: { id: true } })
    if (!found) throw new ContentError('That category no longer exists.')
  }
}

export async function createArticle(
  authorId: string,
  data: {
    titleEn: string
    titleBn?: string | null
    bodyEn: string
    bodyBn?: string | null
    categoryId?: string | null
    cyclePhases?: string[]
    status?: string
  },
  now: Date,
) {
  assertArticleStatus(data.status)
  await assertArticleFields(data, 'create')
  const slug = slugify(data.titleEn) + '-' + now.getTime().toString(36)

  const article = await prisma.article.create({
    data: {
      slug,
      titleEn: data.titleEn,
      titleBn: data.titleBn || null,
      bodyEn: sanitizeArticleHtml(data.bodyEn),
      bodyBn: isBlankBody(data.bodyBn) ? null : sanitizeArticleHtml(data.bodyBn!),
      categoryId: data.categoryId || null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cyclePhases: (data.cyclePhases as never) || [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: (data.status as never) || 'DRAFT',
      authorId,
      publishedAt: data.status === 'PUBLISHED' ? now : null,
    },
  })

  await prisma.adminAuditLog.create({
    data: {
      adminId: authorId,
      action: AUDIT_ACTIONS.ARTICLE_CREATED,
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
    /** `null` or empty string clears the field. `undefined` leaves it unchanged. */
    titleBn?: string | null
    bodyEn?: string
    bodyBn?: string | null
    categoryId?: string | null
    cyclePhases?: string[]
    status?: string
  },
  now: Date,
) {
  assertArticleStatus(data.status)
  await assertArticleFields(data, 'update')
  const updateData: Record<string, unknown> = { ...data }

  if (typeof data.bodyEn === 'string') updateData.bodyEn = sanitizeArticleHtml(data.bodyEn)
  if (data.titleBn !== undefined) updateData.titleBn = data.titleBn?.trim() || null
  if (data.bodyBn !== undefined) {
    updateData.bodyBn = isBlankBody(data.bodyBn) ? null : sanitizeArticleHtml(data.bodyBn!)
  }
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || null

  if (data.status === 'PUBLISHED') {
    const existing = await prisma.article.findUnique({ where: { id } })
    if (existing && !existing.publishedAt) {
      updateData.publishedAt = now
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
      action: AUDIT_ACTIONS.ARTICLE_DELETED,
      targetType: 'Article',
      targetId: id,
    },
  })

  return { success: true }
}

// ── Category mutations ─────────────────────────────────────────────────────────

const CATEGORY_TYPE = 'ArticleCategory'

/** Slug for a category name. Bangla-only names slugify to "", so fall back to `category` and add -2, -3 ... until free. */
async function uniqueCategorySlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name) || 'category'
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`
    const taken = await prisma.articleCategory.findFirst({
      where: { slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    })
    if (!taken) return candidate
  }
}

function cleanCategoryName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Category name is required')
  return trimmed
}

function rethrowDuplicateName(e: unknown, name: string): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    throw new Error(`A category named "${name}" already exists`)
  }
  throw e
}

export async function createCategory(adminId: string, name: string, nameBn?: string | null) {
  const clean = cleanCategoryName(name)
  const max = await prisma.articleCategory.aggregate({ _max: { sortOrder: true } })
  try {
    const category = await prisma.articleCategory.create({
      data: {
        name: clean,
        nameBn: nameBn?.trim() || null,
        slug: await uniqueCategorySlug(clean),
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
    })
    await createAuditLog(adminId, AUDIT_ACTIONS.CATEGORY_CREATED, CATEGORY_TYPE, category.id, { name: category.name })
    return category
  } catch (e) {
    return rethrowDuplicateName(e, clean)
  }
}

export async function updateCategory(adminId: string, id: string, name: string, nameBn?: string | null) {
  const clean = cleanCategoryName(name)
  const existing = await prisma.articleCategory.findUnique({ where: { id }, select: { name: true } })
  if (!existing) throw new Error('Category not found')
  const data: { name: string; slug?: string; nameBn?: string | null } = { name: clean }
  // The slug follows the name only when the name changes; renaming keeps links stable otherwise.
  if (clean !== existing.name) data.slug = await uniqueCategorySlug(clean, id)
  if (nameBn !== undefined) data.nameBn = nameBn?.trim() || null
  try {
    const category = await prisma.articleCategory.update({ where: { id }, data })
    if (clean !== existing.name) {
      await createAuditLog(adminId, AUDIT_ACTIONS.CATEGORY_RENAMED, CATEGORY_TYPE, id, { from: existing.name, to: clean })
    }
    return category
  } catch (e) {
    return rethrowDuplicateName(e, clean)
  }
}

export async function removeCategory(adminId: string, id: string) {
  const category = await prisma.articleCategory.findUnique({ where: { id }, select: { name: true } })
  if (!category) throw new Error('Category not found')
  const count = await prisma.article.count({ where: { categoryId: id } })
  if (count > 0) throw new ContentError('Cannot delete a category that still has articles.')
  await prisma.articleCategory.delete({ where: { id } })
  await createAuditLog(adminId, AUDIT_ACTIONS.CATEGORY_DELETED, CATEGORY_TYPE, id, { name: category.name })
  return { success: true }
}

/** Persist a new category order. `orderedIds` must list every category exactly once. */
export async function reorderCategories(adminId: string, orderedIds: string[]) {
  const all = await prisma.articleCategory.findMany({ select: { id: true } })
  const known = new Set(all.map((c) => c.id))
  const valid =
    orderedIds.length === known.size &&
    new Set(orderedIds).size === orderedIds.length &&
    orderedIds.every((id) => known.has(id))
  if (!valid) throw new Error('Categories changed since this page loaded. Reload and try again.')
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.articleCategory.update({ where: { id }, data: { sortOrder: index + 1 } }),
    ),
  )
  await createAuditLog(adminId, AUDIT_ACTIONS.CATEGORY_REORDERED, CATEGORY_TYPE, 'all', { count: orderedIds.length })
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

/**
 * Derive a short plain-text excerpt from rich-text HTML. Strips tags, collapses
 * whitespace and truncates so only a small snippet (not the full @db.Text body)
 * is ever sent to the client.
 */
function toExcerpt(html: string | null | undefined, max = 160): string {
  if (!html) return ''
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text
}

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

  const [rows, total] = await Promise.all([
    prisma.article.findMany({
      where,
      // bodyEn/bodyBn are read in-datacenter (cheap) only to derive excerpts;
      // they are stripped out below so the full Text never reaches the client.
      select: {
        id: true,
        slug: true,
        titleEn: true,
        titleBn: true,
        bodyEn: true,
        bodyBn: true,
        status: true,
        cyclePhases: true,
        publishedAt: true,
        category: { select: { id: true, name: true, nameBn: true } },
        author: { select: { fullName: true } },
      },
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.article.count({ where }),
  ])

  // Map to lightweight list rows: replace full bodies with short excerpts so the
  // client payload carries only ~160-char snippets, never the full Text.
  const articles = rows.map(({ bodyEn, bodyBn, ...rest }) => ({
    ...rest,
    excerptEn: toExcerpt(bodyEn),
    excerptBn: toExcerpt(bodyBn),
  }))

  return {
    articles,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

/** Fetch a single published article's body for on-demand rendering. */
export async function getPublishedArticleById(id: string) {
  return prisma.article.findFirst({
    where: { id, status: 'PUBLISHED' },
    select: {
      id: true,
      titleEn: true,
      titleBn: true,
      bodyEn: true,
      bodyBn: true,
      cyclePhases: true,
      publishedAt: true,
      category: { select: { name: true, nameBn: true } },
    },
  })
}
