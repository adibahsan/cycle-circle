'use server'

import { requireAdminAuth, getAuthUser } from '@vesta/shared/server/auth'
import {
  createOneDayCampaign,
  createOneDayCampaignsBulk,
  deleteCampaign,
  sendCampaignMessage,
  updateCampaignMessage,
  rescheduleCampaignMessage,
  parseBulkSmsInput,
  parseSmsCsv,
  scheduleDrafts,
  type SmsSendLanguage,
} from '@vesta/shared/server/services'
import { bangladeshDayOf } from '@vesta/shared/utils/dhaka-date'
import { revalidateTag } from 'next/cache'
import { adminCacheTags } from '@/lib/admin-cache-tags'

/** Create a one-day campaign. `scheduledFor` is an ISO instant; its Bangladesh day is the send day. */
export async function createSmsCampaign(
  message: string,
  messageBn?: string,
  scheduledFor?: string,
  sendLanguage: SmsSendLanguage = 'BOTH',
) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  const campaign = await createOneDayCampaign(admin.id, {
    message,
    messageBn,
    scheduledFor,
    sendLanguage,
    now: new Date(),
  })

  revalidateTag(adminCacheTags.sms, { expire: 0 })
  return { id: campaign.id }
}

export async function createSmsCampaignsBulk(
  rawText: string,
  startDate?: string,
  sendLanguage: SmsSendLanguage = 'BOTH',
) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  const rows = parseBulkSmsInput(rawText)
  const created = await createOneDayCampaignsBulk(admin.id, rows, { startDate, sendLanguage, now: new Date() })

  revalidateTag(adminCacheTags.sms, { expire: 0 })
  return { count: created.length }
}

export async function deleteSmsCampaign(campaignId: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  await deleteCampaign(campaignId, admin.id)

  revalidateTag(adminCacheTags.sms, { expire: 0 })
  return { success: true }
}

export async function sendSmsMessage(messageId: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  try {
    await sendCampaignMessage(messageId, admin.id, new Date())
  } finally {
    // Also after a failed send, so the list shows the FAILED status.
    revalidateTag(adminCacheTags.sms, { expire: 0 })
  }
  return { success: true }
}

/** Parse a CSV and return each line with the Bangladesh day it would go out. Nothing is saved. */
export async function previewSmsCsv(csvText: string, startDate?: string) {
  await requireAdminAuth()
  const { drafts, errors } = parseSmsCsv(csvText)
  const days = scheduleDrafts(drafts, startDate, new Date()).map(bangladeshDayOf)
  return {
    errors,
    rows: drafts.map((d, i) => ({ ...d, day: days[i] })),
  }
}

/** Create one-day campaigns from a CSV. Refuses if any line is invalid. */
export async function createSmsCampaignsFromCsv(
  csvText: string,
  startDate?: string,
  sendLanguage: SmsSendLanguage = 'BOTH',
) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  const { drafts, errors } = parseSmsCsv(csvText)
  if (errors.length > 0) throw new Error(`Fix ${errors.length} CSV line(s) first (line ${errors[0].line}: ${errors[0].message})`)
  if (drafts.length === 0) throw new Error('The CSV has no messages')
  const created = await createOneDayCampaignsBulk(admin.id, drafts, { startDate, sendLanguage, now: new Date() })

  revalidateTag(adminCacheTags.sms, { expire: 0 })
  return { count: created.length }
}

/** Edit the text of an unsent message. */
export async function updateSmsMessage(messageId: string, input: { body: string }) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  await updateCampaignMessage(messageId, admin.id, input)

  revalidateTag(adminCacheTags.sms, { expire: 0 })
  return { success: true }
}

/** Move an unsent message to another Bangladesh day (`YYYY-MM-DD`). */
export async function rescheduleSmsMessage(messageId: string, day: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  await rescheduleCampaignMessage(messageId, admin.id, day)

  revalidateTag(adminCacheTags.sms, { expire: 0 })
  return { success: true }
}
