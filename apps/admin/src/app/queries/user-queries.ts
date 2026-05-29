import { cache } from 'react'
import { prisma } from '@vesta/shared'
import { requireAdminUser } from './auth-queries'

interface UserListParams {
  page?: number
  pageSize?: number
  search?: string
  status?: 'all' | 'active' | 'suspended' | 'deleted'
  role?: 'all' | 'USER' | 'ADMIN'
}

export const getUsers = cache(async (params: UserListParams = {}) => {
  await requireAdminUser()

  const { page = 1, pageSize = 20, search, status = 'all', role = 'all' } = params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}

  if (status === 'active') {
    where.deletedAt = null
    where.suspendedAt = null
  } else if (status === 'suspended') {
    where.suspendedAt = { not: null }
    where.deletedAt = null
  } else if (status === 'deleted') {
    where.deletedAt = { not: null }
  } else {
    // 'all' — exclude soft-deleted by default
    where.deletedAt = null
  }

  if (role !== 'all') {
    where.role = role
  }

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
    ]
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        phone: true,
        email: true,
        fullName: true,
        authMethod: true,
        subscriptionStatus: true,
        role: true,
        profileCompleted: true,
        suspendedAt: true,
        deletedAt: true,
        lastLoginAt: true,
        createdAt: true,
        _count: { select: { profiles: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ])

  return {
    users,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
})

export const getUserDetail = cache(async (userId: string) => {
  await requireAdminUser()

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profiles: {
        include: {
          periodLogs: { orderBy: { startDate: 'desc' }, take: 5 },
          predictions: true,
          notificationPref: true,
          _count: { select: { periodLogs: true, symptomLogs: true } },
        },
      },
      subscriptions: {
        include: {
          caasTransactions: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      },
      feedback: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  })

  if (!user) throw new Error('User not found')
  return user
})
