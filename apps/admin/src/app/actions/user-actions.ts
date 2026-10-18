'use server'

import { requireAdminAuth, getAuthUser } from '@vesta/shared/server/auth'
import {
  suspendUser as svcSuspendUser,
  reactivateUser as svcReactivateUser,
  softDeleteUser as svcSoftDeleteUser,
  restoreUser as svcRestoreUser,
  setSubscriptionStatus,
  adminSetNotificationPrefs,
} from '@vesta/shared/server/services'
import { grantPro, revokePro } from '@vesta/shared/server/services'
import { revalidateTag } from 'next/cache'
import { adminCacheTags } from '@/lib/admin-cache-tags'
import { revalidateWebTags } from '@/lib/revalidate-web'

function revalidateUserTags(userId: string) {
  revalidateTag(adminCacheTags.users, { expire: 0 })
  revalidateTag(adminCacheTags.user(userId), { expire: 0 })
  revalidateTag(adminCacheTags.dashboard, { expire: 0 })
}

export async function suspendUser(userId: string, reason: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  const { bdapps } = await svcSuspendUser(userId, admin.id, reason)

  revalidateUserTags(userId)
  await revalidateWebTags([`user:${userId}`])
  return { success: true, bdappsError: bdapps.status === 'failed' ? bdapps.error : null }
}

export async function reactivateUser(userId: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  await svcReactivateUser(userId, admin.id)

  revalidateUserTags(userId)
  await revalidateWebTags([`user:${userId}`])
  return { success: true }
}

export async function softDeleteUser(userId: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  const { bdapps } = await svcSoftDeleteUser(userId, admin.id)

  revalidateUserTags(userId)
  await revalidateWebTags([`user:${userId}`])
  return { success: true, bdappsError: bdapps.status === 'failed' ? bdapps.error : null }
}

export async function restoreUser(userId: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  await svcRestoreUser(userId, admin.id)

  revalidateUserTags(userId)
  await revalidateWebTags([`user:${userId}`])
  return { success: true }
}

export async function grantProAccess(userId: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  await grantPro(userId, admin.id)

  revalidateUserTags(userId)
  revalidateTag(adminCacheTags.subscriptions, { expire: 0 })
  await revalidateWebTags([`user:${userId}`])
  return { success: true }
}

export async function revokeProAccess(userId: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  const { bdapps } = await revokePro(userId, admin.id)

  revalidateUserTags(userId)
  revalidateTag(adminCacheTags.subscriptions, { expire: 0 })
  await revalidateWebTags([`user:${userId}`])
  return { success: true, bdappsError: bdapps.status === 'failed' ? bdapps.error : null }
}

export async function setUserSubscriptionStatus(userId: string, status: 'PRO' | 'FREE' | 'LAPSED') {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  const { bdapps } = await setSubscriptionStatus(userId, status, admin.id)

  revalidateUserTags(userId)
  revalidateTag(adminCacheTags.subscriptions, { expire: 0 })
  await revalidateWebTags([`user:${userId}`])
  // Our change applied either way; the admin sees if the BDApps unsubscribe step failed.
  return { success: true, bdappsError: bdapps?.status === 'failed' ? bdapps.error : null }
}

export async function setUserNotificationPrefs(
  userId: string,
  profileId: string,
  data: { periodAlert?: boolean; fertileWindow?: boolean; loggingReminder?: boolean },
) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  await adminSetNotificationPrefs(profileId, data, admin.id)

  revalidateUserTags(userId)
  return { success: true }
}
