'use server'

import { requireAdminAuth, getAuthUser } from '@vesta/shared/server/auth'
import {
  createCampaign,
  importCampaignCsv,
  CampaignImportError,
  addCampaignMessage,
  deleteCampaign,
  sendCampaignMessage,
  updateCampaignMessage,
  rescheduleCampaignMessage,
  removeCampaignMessage,
  cancelCampaign,
  resendCampaignMessage,
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

/** The rows an import was refused for; `error` is the summary line. */
export interface CampaignImportRefusal {
  error: string
  rowErrors?: { line: number; message: string }[]
}

/** Import a campaign from a `day,text` CSV. Any bad row refuses the whole file, listed by line. */
export async function importSmsCampaignCsv(input: {
  name: string
  csv: string
}): Promise<{ id: string } | CampaignImportRefusal> {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  try {
    const campaign = await importCampaignCsv(admin.id, input, new Date())
    revalidateTag(adminCacheTags.sms, { expire: 0 })
    return { id: campaign.id }
  } catch (err) {
    if (err instanceof CampaignImportError) return { error: err.message, rowErrors: err.rowErrors }
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

export async function deleteSmsCampaign(campaignId: string): Promise<{ success: true } | { error: string }> {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  try {
    await deleteCampaign(campaignId, admin.id)
    revalidateTag(adminCacheTags.sms, { expire: 0 })
    return { success: true }
  } catch (err) {
    return refusal(err)
  }
}

/** Send one planned message now. Refusals, including "sent but saving failed", come back as `{ error }`. */
export async function sendSmsMessage(messageId: string): Promise<{ success: true } | { error: string }> {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  try {
    await sendCampaignMessage(messageId, admin.id, new Date())
    return { success: true }
  } catch (err) {
    return refusal(err)
  } finally {
    // Also after a failed send, so the list shows the FAILED status.
    revalidateTag(adminCacheTags.sms, { expire: 0 })
  }
}

/** Edit the text of an unsent message. */
export async function updateSmsMessage(messageId: string, input: { body: string }): Promise<{ success: true } | { error: string }> {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  try {
    await updateCampaignMessage(messageId, admin.id, input)
    revalidateTag(adminCacheTags.sms, { expire: 0 })
    return { success: true }
  } catch (err) {
    return refusal(err)
  }
}

/** Move an unsent message to another Bangladesh day (`YYYY-MM-DD`). */
export async function rescheduleSmsMessage(messageId: string, day: string): Promise<{ success: true } | { error: string }> {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  try {
    await rescheduleCampaignMessage(messageId, admin.id, day, new Date())
    revalidateTag(adminCacheTags.sms, { expire: 0 })
    return { success: true }
  } catch (err) {
    return refusal(err)
  }
}

/** Remove an unsent message from a campaign (never its last one: delete the campaign instead). */
export async function removeSmsMessage(messageId: string): Promise<{ success: true } | { error: string }> {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  try {
    await removeCampaignMessage(messageId, admin.id)
    revalidateTag(adminCacheTags.sms, { expire: 0 })
    return { success: true }
  } catch (err) {
    return refusal(err)
  }
}

/** Cancel the rest of a campaign: remaining planned days are cancelled, sent ones stay. */
export async function cancelSmsCampaign(
  campaignId: string,
): Promise<{ cancelled: number; sent: number; total: number } | { error: string }> {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  try {
    const result = await cancelCampaign(campaignId, admin.id, new Date())
    revalidateTag(adminCacheTags.sms, { expire: 0 })
    return result
  } catch (err) {
    return refusal(err)
  }
}

/** Resend a failed or missed message on a chosen free Bangladesh day. */
export async function resendSmsMessage(messageId: string, day: string): Promise<{ id: string } | { error: string }> {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  try {
    const message = await resendCampaignMessage(messageId, admin.id, day, new Date())
    revalidateTag(adminCacheTags.sms, { expire: 0 })
    return { id: message.id }
  } catch (err) {
    return refusal(err)
  }
}
