import { cache } from 'react'
import { prisma } from '@vesta/shared'
import { requireAdminUser } from './auth-queries'

export const getArticles = cache(async (params: {
  page?: number
  pageSize?: number
  status?: string
  categoryId?: string
} = {}) => {
  await requireAdminUser()
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
})

export const getArticle = cache(async (id: string) => {
  await requireAdminUser()
  return prisma.article.findUnique({
    where: { id },
    include: {
      category: true,
      author: { select: { fullName: true } },
    },
  })
})

export const getCategories = cache(async () => {
  await requireAdminUser()
  return prisma.articleCategory.findMany({
    include: { _count: { select: { articles: true } } },
    orderBy: { name: 'asc' },
  })
})
