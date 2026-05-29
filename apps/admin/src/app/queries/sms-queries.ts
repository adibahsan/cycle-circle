import { cache } from 'react'
import { prisma } from '@vesta/shared'
import { requireAdminUser } from './auth-queries'

interface SmsBroadcastListParams {
  page?: number
  pageSize?: number
  status?: string
}

export const getSmsBroadcasts = cache(async (params: SmsBroadcastListParams = {}) => {
  await requireAdminUser()

  const { page = 1, pageSize = 20, status } = params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (status && status !== 'all') where.status = status

  const [broadcasts, total] = await Promise.all([
    prisma.smsBroadcast.findMany({
      where,
      include: { creator: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.smsBroadcast.count({ where }),
  ])

  return {
    broadcasts,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
})
