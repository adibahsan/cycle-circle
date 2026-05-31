import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { validateWebhookSource, persistWebhookEvent } from '@vesta/shared/server/adapters/webhooks'

type CaasNotifyPayload = {
  externalTrxId?: string
  internalTrxId?: string
  referenceId?: string
  subscriberId?: string
  status?: string
  statusCode?: string
  timeStamp?: string
}

export async function POST(request: Request): Promise<Response> {
  try {
    if (!validateWebhookSource(request)) {
      throw new ApiError(403, 'Forbidden: unknown webhook source', 'FORBIDDEN')
    }

    const payload = (await request.json()) as CaasNotifyPayload
    await persistWebhookEvent('CAAS_NOTIFY', payload, caasIdempotencyKey(payload))

    return Response.json({ statusCode: 'S1000', statusDetail: 'Received' })
  } catch (error) {
    return handleApiError(error)
  }
}

function caasIdempotencyKey(payload: CaasNotifyPayload) {
  if (payload.externalTrxId) return `caas:${payload.externalTrxId}`
  if (payload.referenceId) return `caas:${payload.referenceId}`
  if (payload.internalTrxId) return `caas:${payload.internalTrxId}`
  return `caas:${payload.subscriberId ?? 'unknown'}:${payload.timeStamp ?? 'unknown'}`
}
