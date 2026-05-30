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

export async function listFeedback(
  params: {
    page?: number
    pageSize?: number
    category?: string
    minRating?: number
    dateFrom?: Date
    dateTo?: Date
  } = {},
) {
  const { page = 1, pageSize = 20, category, minRating, dateFrom, dateTo } = params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (category && category !== 'all') where.category = category
  if (minRating) where.rating = { gte: minRating }
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    }
  }

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
