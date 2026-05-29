'use server'

import { requireAdminAuth, getAuthUser } from '@vesta/shared/server/auth'
import {
  suspendUser as svcSuspendUser,
  reactivateUser as svcReactivateUser,
  softDeleteUser as svcSoftDeleteUser,
} from '@vesta/shared/server/services'
import { grantPro, revokePro } from '@vesta/shared/server/services'
import { revalidatePath } from 'next/cache'

export async function suspendUser(userId: string, reason?: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  await svcSuspendUser(userId, admin.id, reason)

  revalidatePath('/users')
  revalidatePath(`/users/${userId}`)
  return { success: true }
}

export async function reactivateUser(userId: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  await svcReactivateUser(userId, admin.id)

  revalidatePath('/users')
  revalidatePath(`/users/${userId}`)
  return { success: true }
}

export async function softDeleteUser(userId: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  await svcSoftDeleteUser(userId, admin.id)

  revalidatePath('/users')
  return { success: true }
}

export async function grantProAccess(userId: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  await grantPro(userId, admin.id)

  revalidatePath('/users')
  revalidatePath(`/users/${userId}`)
  revalidatePath('/subscriptions')
  return { success: true }
}

export async function revokeProAccess(userId: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  await revokePro(userId, admin.id)

  revalidatePath('/users')
  revalidatePath(`/users/${userId}`)
  revalidatePath('/subscriptions')
  return { success: true }
}
