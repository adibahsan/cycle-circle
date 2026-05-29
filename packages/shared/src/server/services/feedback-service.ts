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

// ── Admin list ─────────────────────────────────────────────────────────────────

export async function listFeedback(
  params: {
    page?: number
    pageSize?: number
    category?: string
    minRating?: number
  } = {},
) {
  const { page = 1, pageSize = 20, category, minRating } = params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (category && category !== 'all') where.category = category
  if (minRating) where.rating = { gte: minRating }

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

// ── Admin export ───────────────────────────────────────────────────────────────

export async function exportFeedbackRows() {
  return prisma.feedback.findMany({
    include: { user: { select: { fullName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  })
}
