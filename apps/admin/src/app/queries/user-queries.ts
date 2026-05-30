import { cache } from 'react'
import { listUsers, getUserDetailForAdmin, type ListUsersParams } from '@vesta/shared/server/services'
import { requireAdminUser } from './auth-queries'

export const getUsers = cache(async (params: ListUsersParams = {}) => {
  await requireAdminUser()
  return listUsers(params)
})

export const getUserDetail = cache(async (userId: string) => {
  await requireAdminUser()
  return getUserDetailForAdmin(userId)
})
