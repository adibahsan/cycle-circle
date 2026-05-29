import { cache } from 'react'
import { prisma } from '@vesta/shared'
import { requireAdminUser } from './auth-queries'

interface FeedbackListParams {
  page?: number
  pageSize?: number
  category?: string
  minRating?: number
}

export const getFeedbackList = cache(async (params: FeedbackListParams = {}) => {
  await requireAdminUser()

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
})
