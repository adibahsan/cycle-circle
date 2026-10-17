import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { validateWebhookSource, persistWebhookEvent } from '@vesta/shared/server/adapters/webhooks'
import { withRequestContext, logger } from '@vesta/shared/server/log'

export async function POST(request: Request): Promise<Response> {
  return withRequestContext(async () => {
  try {
    if (!validateWebhookSource(request)) {
      throw new ApiError(401, 'Unauthorized: unknown webhook source', 'UNAUTHORIZED')
    }

    const payload = await request.json() as {
      sourceAddress: string
      message: string
      messageId: string
      timeStamp: string
    }

    const { duplicate } = await persistWebhookEvent('SMS_RECEIVE', payload, payload.messageId)
    logger.webhook('sms.receive', { payload, action: duplicate ? 'ignored' : 'stored', ...(duplicate && { reason: 'duplicate' }) })

    return Response.json({ statusCode: 'S1000', statusDetail: 'Received' })
  } catch (error) {
    if (error instanceof ApiError && error.statusCode < 500) {
      logger.webhook('sms.receive', { ok: false, status: error.statusCode, code: error.code, message: error.message }, { level: 'warn' })
    }
    return handleApiError(error)
  }
  }, { requestId: request.headers.get('x-request-id') ?? undefined })
}
