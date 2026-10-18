import type { FeedbackCategory, Prisma } from '@prisma/client'
import { prisma } from '../db'

// ── Create ─────────────────────────────────────────────────────────────────────

export async function createFeedback(
  userId: string,
  data: {
    profileId?: string
    category: 'BUG' | 'FEATURE' | 'GENERAL' | 'SATISFACTION'
    message: string
    rating?: number
  },
) {
  return prisma.feedback.create({
    data: {
      userId,
      profileId: data.profileId,
      category: data.category,
      message: data.message,
      rating: data.rating,
    },
  })
}

// ── User-facing list ──────────────────────────────────────────────────────

export async function listUserFeedback(userId: string, take = 20) {
  return prisma.feedback.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
  })
}

// ── Admin list ─────────────────────────────────────────────────────────────────

export type FeedbackFilters = {
  category?: string
  /** Exact rating; wins over minRating when both are set. */
  rating?: number
  /** At-least rating. */
  minRating?: number
  dateFrom?: Date
  dateTo?: Date
  /** Case-insensitive match on message, user name or user email. */
  search?: string
}

/** Single source of truth for the admin list and CSV export filters. */
export function buildFeedbackWhere(filters: FeedbackFilters = {}): Prisma.FeedbackWhereInput {
  const { category, rating, minRating, dateFrom, dateTo } = filters
  const search = filters.search?.trim()
  const where: Prisma.FeedbackWhereInput = {}
  if (category && category !== 'all') where.category = category as FeedbackCategory
  if (rating) where.rating = rating
  else if (minRating) where.rating = { gte: minRating }
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    }
  }
  if (search) {
    where.OR = [
      { message: { contains: search, mode: 'insensitive' } },
      { user: { fullName: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ]
  }
  return where
}

export async function listFeedback(params: FeedbackFilters & { page?: number; pageSize?: number } = {}) {
  const { page = 1, pageSize = 20 } = params
  const where = buildFeedbackWhere(params)

  const [items, total] = await Promise.all([
    prisma.feedback.findMany({
      where,
      include: { user: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.feedback.count({ where }),
  ])

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

// ── Admin detail ─────────────────────────────────────────────────────────────

export async function getFeedbackById(id: string) {
  const feedback = await prisma.feedback.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, fullName: true, email: true, phone: true } },
    },
  })

  if (!feedback) return null

  const profile = feedback.profileId
    ? await prisma.profile.findUnique({
        where: { id: feedback.profileId },
        select: { id: true, name: true, relation: true },
      })
    : null

  return { ...feedback, profile }
}

// ── Admin export ───────────────────────────────────────────────────────────────

export async function exportFeedbackRows() {
  return prisma.feedback.findMany({
    include: { user: { select: { fullName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

// ── Chart aggregations ─────────────────────────────────────────────────────────

type DateRangeOpts = { dateFrom?: Date; dateTo?: Date; days?: number }

function resolveDateRange(opts: DateRangeOpts = {}): { startDate: Date; endDate: Date } {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  const now = new Date()
  const { dateFrom, dateTo, days = 30 } = opts

  if (dateFrom && dateTo) return { startDate: dateFrom, endDate: dateTo }
  if (dateFrom) return { startDate: dateFrom, endDate: now }
  if (dateTo) return { startDate: new Date(dateTo.getTime() - days * MS_PER_DAY), endDate: dateTo }
  return { startDate: new Date(now.getTime() - days * MS_PER_DAY), endDate: now }
}

/**
 * Daily feedback submission counts, gap-filled with zeros.
 * Default range: last 30 days.
 */
export async function getFeedbackVolumeByDate(
  opts: DateRangeOpts = {},
): Promise<{ date: string; count: number }[]> {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  const { startDate, endDate } = resolveDateRange(opts)

  const rows = await prisma.feedback.findMany({
    where: { createdAt: { gte: startDate, lte: endDate } },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  // Pre-fill every date bucket with zero across the full range
  const dailyCounts: Record<string, number> = {}
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1
  for (let i = 0; i < totalDays; i++) {
    const date = new Date(startDate.getTime() + i * MS_PER_DAY)
    dailyCounts[date.toISOString().split('T')[0]] = 0
  }

  for (const row of rows) {
    const dateKey = row.createdAt.toISOString().split('T')[0]
    if (dailyCounts[dateKey] !== undefined) dailyCounts[dateKey]++
  }

  return Object.entries(dailyCounts).map(([date, count]) => ({ date, count }))
}

/**
 * Feedback counts grouped by category.
 * Default range: last 30 days.
 */
export async function getFeedbackByCategory(
  opts: DateRangeOpts = {},
): Promise<{ category: 'BUG' | 'FEATURE' | 'GENERAL' | 'SATISFACTION'; count: number }[]> {
  const { startDate, endDate } = resolveDateRange(opts)

  const rows = await prisma.feedback.groupBy({
    by: ['category'],
    where: { createdAt: { gte: startDate, lte: endDate } },
    _count: { id: true },
  })

  return rows.map(r => ({
    category: r.category as 'BUG' | 'FEATURE' | 'GENERAL' | 'SATISFACTION',
    count: r._count.id,
  }))
}

/**
 * Feedback counts grouped by rating value (1–5 and null for no rating).
 * Default range: last 30 days.
 */
export async function getFeedbackRatingDistribution(
  opts: DateRangeOpts = {},
): Promise<{ rating: number | null; count: number }[]> {
  const { startDate, endDate } = resolveDateRange(opts)

  const rows = await prisma.feedback.groupBy({
    by: ['rating'],
    where: { createdAt: { gte: startDate, lte: endDate } },
    _count: { id: true },
  })

  return rows
    .map(r => ({ rating: r.rating, count: r._count.id }))
    .sort((a, b) => {
      if (a.rating === null) return 1
      if (b.rating === null) return -1
      return a.rating - b.rating
    })
}
