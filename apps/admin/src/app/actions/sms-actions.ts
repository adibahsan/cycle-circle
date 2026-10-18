'use server'

import { requireAdminAuth, getAuthUser } from '@vesta/shared/server/auth'
import {
  createBroadcast,
  createBroadcastsBulk,
  deleteBroadcast,
  sendBroadcast,
  parseBulkSmsInput,
  parseSmsCsv,
  scheduleDrafts,
  type SmsSendLanguage,
} from '@vesta/shared/server/services'
import { revalidateTag } from 'next/cache'
import { adminCacheTags } from '@/lib/admin-cache-tags'

export async function createSmsBroadcast(
  message: string,
  messageBn?: string,
  scheduledFor?: string,
  sendLanguage: SmsSendLanguage = 'BOTH',
) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  const broadcast = await createBroadcast(admin.id, message, messageBn, scheduledFor, sendLanguage)

  revalidateTag(adminCacheTags.sms, { expire: 0 })
  return broadcast
}

export async function createSmsBroadcastsBulk(
  rawText: string,
  startDate?: string,
  sendLanguage: SmsSendLanguage = 'BOTH',
) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  const rows = parseBulkSmsInput(rawText)
  const created = await createBroadcastsBulk(admin.id, rows, startDate, sendLanguage)

  revalidateTag(adminCacheTags.sms, { expire: 0 })
  return { count: created.length, broadcasts: created }
}

export async function deleteSmsBroadcast(id: string) {
  await requireAdminAuth()

  await deleteBroadcast(id)

  revalidateTag(adminCacheTags.sms, { expire: 0 })
  return { success: true }
}

export async function sendSmsBroadcast(id: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  await sendBroadcast(id, admin.id)

  revalidateTag(adminCacheTags.sms, { expire: 0 })
  return { success: true }
}

/** Parse a CSV and return each line with the date it would go out — nothing is saved. */
export async function previewSmsCsv(csvText: string, startDate?: string) {
  await requireAdminAuth()
  const { drafts, errors } = parseSmsCsv(csvText)
  const dates = scheduleDrafts(drafts, startDate)
  return {
    errors,
    rows: drafts.map((d, i) => ({ ...d, sendAt: dates[i].toISOString() })),
  }
}

/** Create SCHEDULED broadcasts from a CSV. Refuses if any line is invalid. */
export async function createSmsBroadcastsFromCsv(
  csvText: string,
  startDate?: string,
  sendLanguage: SmsSendLanguage = 'BOTH',
) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  const { drafts, errors } = parseSmsCsv(csvText)
  if (errors.length > 0) throw new Error(`Fix ${errors.length} CSV line(s) first (line ${errors[0].line}: ${errors[0].message})`)
  if (drafts.length === 0) throw new Error('The CSV has no messages')
  const created = await createBroadcastsBulk(admin.id, drafts, startDate, sendLanguage)

  revalidateTag(adminCacheTags.sms, { expire: 0 })
  return { count: created.length }
}
