import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { validateWebhookSource, persistWebhookEvent } from '@vesta/shared/server/adapters/webhooks'
import { syncBdappsSubscriptionBySubscriberId } from '@vesta/shared/server/services'
import { env } from '@vesta/shared/utils/env'
import { revalidateTag } from 'next/cache'
import { cacheTags } from '@/lib/cache-tags'
import { mapNotifyStatus } from '@/lib/subscription-notify'

export async function POST(request: Request): Promise<Response> {
  try {
    if (!validateWebhookSource(request)) {
      throw new ApiError(401, 'Unauthorized: unknown webhook source', 'UNAUTHORIZED')
    }

    const payload = await request.json() as {
      applicationId?: string
      subscriberId?: string
      status?: string
      timeStamp?: string
    }

    if (payload.applicationId && payload.applicationId !== env.BDAPPS_APP_ID) {
      throw new ApiError(401, 'Unauthorized: unknown application', 'UNAUTHORIZED')
    }

    const ok = () => Response.json({ statusCode: 'S1000', statusDetail: 'Received' })

    const idempotencyKey = `${payload.subscriberId}:${payload.timeStamp}`
    const { duplicate } = await persistWebhookEvent('SUBSCRIPTION_NOTIFY', payload, idempotencyKey)
    if (duplicate) return ok()

    const change = mapNotifyStatus(payload.status)
    if (!change) {
      console.warn('[bdapps-notify] ignoring unhandled status', payload.status)
      return ok()
    }

    console.info('[bdapps-notify]', JSON.stringify(payload))
    if (!payload.subscriberId) return ok()

    // Masked ids (our app) match the id stored at OTP verify; unmasked ones the phone.
    const updated = await syncBdappsSubscriptionBySubscriberId(payload.subscriberId, change === 'registered')
    if (!updated) console.warn('[bdapps-notify] no user for subscriberId', payload.subscriberId)
    if (updated) revalidateTag(cacheTags.user(updated.userId), { expire: 0 })

    return ok()
  } catch (error) {
    return handleApiError(error)
  }
}
