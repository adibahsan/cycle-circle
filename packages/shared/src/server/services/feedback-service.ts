import type { FeedbackCategory, Prisma } from '@prisma/client'
import { prisma } from '../db'
import { bangladeshDayOf } from '../../utils/dhaka-date'
import { fillDaySeries, resolveDaySeriesRange, type DaySeriesOpts } from '../../utils/day-series'

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

type DateRangeOpts = DaySeriesOpts

/** Whole Bangladesh days, so every feedback chart covers the same window. */
function resolveDateRange(opts: DateRangeOpts): {
  startDate: Date
  endDate: Date
  fromDay: string
  toDay: string
} {
  const { from, to, fromDay, toDay } = resolveDaySeriesRange(opts)
  return { startDate: from, endDate: to, fromDay, toDay }
}

/**
 * Daily feedback submission counts, gap-filled with zeros.
 * Default range: last 30 days.
 */
export async function getFeedbackVolumeByDate(
  opts: DateRangeOpts,
): Promise<{ date: string; count: number }[]> {
  const { startDate, endDate, fromDay, toDay } = resolveDateRange(opts)

  const rows = await prisma.feedback.findMany({
    where: { createdAt: { gte: startDate, lte: endDate } },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  const counts = new Map<string, number>()
  for (const row of rows) {
    const day = bangladeshDayOf(row.createdAt)
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }

  return fillDaySeries(fromDay, toDay, counts)
}

/**
 * Feedback counts grouped by category.
 * Default range: last 30 days.
 */
export async function getFeedbackByCategory(
  opts: DateRangeOpts,
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
  opts: DateRangeOpts,
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
