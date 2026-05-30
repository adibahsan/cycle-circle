import { cache } from 'react'
import { prisma } from '@vesta/shared'
import { listUsers, type ListUsersParams } from '@vesta/shared/server/services'
import { requireAdminUser } from './auth-queries'

export const getUsers = cache(async (params: ListUsersParams = {}) => {
  await requireAdminUser()
  return listUsers(params)
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
