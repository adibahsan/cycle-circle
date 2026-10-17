import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { validateWebhookSource, persistWebhookEvent } from '@vesta/shared/server/adapters/webhooks'
import { syncBdappsSubscriptionBySubscriberId } from '@vesta/shared/server/services'
import { env } from '@vesta/shared/utils/env'
import { revalidateTag } from 'next/cache'
import { cacheTags } from '@/lib/cache-tags'
import { mapNotifyStatus } from '@/lib/subscription-notify'
import { withRequestContext, logger } from '@vesta/shared/server/log'

export async function POST(request: Request): Promise<Response> {
  return withRequestContext(async () => {
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
    if (duplicate) {
      logger.webhook('subscription.notify', { payload, action: 'ignored', reason: 'duplicate' })
      return ok()
    }

    const change = mapNotifyStatus(payload.status)
    if (!change) {
      logger.webhook('subscription.notify', { payload, action: 'ignored', reason: 'unhandled-status' })
      return ok()
    }

    if (!payload.subscriberId) {
      logger.webhook('subscription.notify', { payload, action: 'ignored', reason: 'no-subscriber-id' })
      return ok()
    }

    // Masked ids (our app) match the id stored at OTP verify; unmasked ones the phone.
    const updated = await syncBdappsSubscriptionBySubscriberId(payload.subscriberId, change === 'registered')
    if (updated) {
      revalidateTag(cacheTags.user(updated.userId), { expire: 0 })
      logger.webhook('subscription.notify', { payload, action: 'synced', change, matchedUserId: updated.userId }, { userId: updated.userId })
    } else {
      logger.webhook('subscription.notify', { payload, action: 'ignored', reason: 'no-matching-user' }, { level: 'warn' })
    }

    return ok()
  } catch (error) {
    if (error instanceof ApiError && error.statusCode < 500) {
      logger.webhook('subscription.notify', { ok: false, status: error.statusCode, code: error.code, message: error.message }, { level: 'warn' })
    }
    return handleApiError(error)
  }
  }, { requestId: request.headers.get('x-request-id') ?? undefined })
}
