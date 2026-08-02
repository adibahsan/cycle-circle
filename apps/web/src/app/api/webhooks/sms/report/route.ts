import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { validateWebhookSource, persistWebhookEvent } from '@vesta/shared/server/adapters/webhooks'
import { recordSmsDeliveryReport } from '@vesta/shared/server/services'

export async function POST(request: Request): Promise<Response> {
  try {
    if (!validateWebhookSource(request)) {
      throw new ApiError(401, 'Unauthorized: unknown webhook source', 'UNAUTHORIZED')
    }

    const payload = await request.json() as {
      destinationAddress: string
      requestId: string
      deliveryStatus: string
      timeStamp: string
    }

    // A tel:all broadcast yields one report per recipient sharing the same
    // requestId, so the idempotency key is per-recipient. Only NEW reports
    // update the broadcast's delivery counts (retries must not double-count).
    const result = await persistWebhookEvent(
      'SMS_REPORT',
      payload,
      `${payload.requestId}:${payload.destinationAddress ?? ''}`,
    )
    if (!result.duplicate) {
      await recordSmsDeliveryReport(payload.requestId, payload.deliveryStatus)
    }

    return Response.json({ statusCode: 'S1000', statusDetail: 'Received' })
  } catch (error) {
    return handleApiError(error)
  }
}
