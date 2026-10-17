import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { validateWebhookSource, persistWebhookEvent } from '@vesta/shared/server/adapters/webhooks'
import { recordSmsDeliveryReport } from '@vesta/shared/server/services'
import { withRequestContext, logger } from '@vesta/shared/server/log'

export async function POST(request: Request): Promise<Response> {
  return withRequestContext(async () => {
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
    logger.webhook('sms.report', {
      payload,
      action: result.duplicate ? 'ignored' : 'recorded',
      ...(result.duplicate && { reason: 'duplicate' }),
    })

    return Response.json({ statusCode: 'S1000', statusDetail: 'Received' })
  } catch (error) {
    if (error instanceof ApiError && error.statusCode < 500) {
      logger.webhook('sms.report', { ok: false, status: error.statusCode, code: error.code, message: error.message }, { level: 'warn' })
    }
    return handleApiError(error)
  }
  }, { requestId: request.headers.get('x-request-id') ?? undefined })
}
