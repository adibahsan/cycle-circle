import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { validateWebhookSource, persistWebhookEvent } from '@vesta/shared/server/adapters/webhooks'
import { handleSubscriptionWebhook } from '@vesta/shared/server/services'

type SubscriptionStatus = 'PRO' | 'LAPSED' | 'FREE'

function mapBdappsStatus(status: string): SubscriptionStatus {
  switch (status.toUpperCase()) {
    case 'ACTIVE':
      return 'PRO'
    case 'INACTIVE':
    case 'SUSPENDED':
    case 'EXPIRED':
      return 'LAPSED'
    default:
      return 'LAPSED'
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    if (!validateWebhookSource(request)) {
      throw new ApiError(403, 'Forbidden: unknown webhook source', 'FORBIDDEN')
    }

    const payload = await request.json() as {
      subscriberId: string
      status: string
      reason?: string
      timeStamp: string
    }

    const idempotencyKey = `${payload.subscriberId}:${payload.timeStamp}`
    await persistWebhookEvent('SUBSCRIPTION_NOTIFY', payload, idempotencyKey)

    const newStatus = mapBdappsStatus(payload.status)

    const phone = payload.subscriberId.startsWith('tel:')
      ? payload.subscriberId
      : `tel:${payload.subscriberId}`

    await handleSubscriptionWebhook(phone, newStatus)

    return Response.json({ statusCode: 'S1000', statusDetail: 'Received' })
  } catch (error) {
    return handleApiError(error)
  }
}
