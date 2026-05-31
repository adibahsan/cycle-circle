import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { listUsers, getUserDetailForAdmin, type ListUsersParams } from '@vesta/shared/server/services'
import { requireAdminUser } from './auth-queries'
import { adminCacheTags, ADMIN_CACHE_TTL } from '@/lib/admin-cache-tags'

function usersCacheKey(params: ListUsersParams) {
  return [
    'admin-users',
    String(params.page ?? 1),
    String(params.pageSize ?? 20),
    params.status ?? '',
    params.search ?? '',
    params.role ?? '',
    params.sort ?? '',
    params.order ?? '',
  ]
}

export const getUsers = cache(async (params: ListUsersParams = {}) => {
  await requireAdminUser()
  return unstable_cache(
    () => listUsers(params),
    usersCacheKey(params),
    { tags: [adminCacheTags.users], revalidate: ADMIN_CACHE_TTL }
  )()
})

export const getUserDetail = cache(async (userId: string) => {
  await requireAdminUser()
  return unstable_cache(
    () => getUserDetailForAdmin(userId),
    ['admin-user-detail', userId],
    { tags: [adminCacheTags.user(userId), adminCacheTags.users], revalidate: ADMIN_CACHE_TTL }
  )()
})
