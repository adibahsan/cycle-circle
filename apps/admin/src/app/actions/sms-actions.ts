'use server'

import { requireAdminAuth, getAuthUser } from '@vesta/shared/server/auth'
import {
  createCampaign,
  addCampaignMessage,
  deleteCampaign,
  sendCampaignMessage,
  updateCampaignMessage,
  rescheduleCampaignMessage,
} from '@vesta/shared/server/services'
import { revalidateTag } from 'next/cache'
import { adminCacheTags } from '@/lib/admin-cache-tags'

/** What the composer sends: one text per Bangladesh day (`YYYY-MM-DD`). */
export interface CampaignComposerInput {
  name: string
  messages: { day: string; body: string }[]
}

/** Domain refusals come back as `{ error }`: a thrown message is masked in production builds. */
function refusal(err: unknown): { error: string } {
  return { error: err instanceof Error ? err.message : 'Something went wrong' }
}

/** Plan a campaign. Past days, clashing days and bad texts are refused with a readable message. */
export async function createSmsCampaign(input: CampaignComposerInput): Promise<{ id: string } | { error: string }> {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  try {
    const campaign = await createCampaign(admin.id, input, new Date())
    revalidateTag(adminCacheTags.sms, { expire: 0 })
    return { id: campaign.id }
  } catch (err) {
    return refusal(err)
  }
}

/** Add one message (a free Bangladesh day) to an existing campaign. */
export async function addSmsMessage(
  campaignId: string,
  input: { day: string; body: string },
): Promise<{ id: string } | { error: string }> {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  try {
    const message = await addCampaignMessage(campaignId, admin.id, input, new Date())
    revalidateTag(adminCacheTags.sms, { expire: 0 })
    return { id: message.id }
  } catch (err) {
    return refusal(err)
  }
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
