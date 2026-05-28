import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { validateWebhookSource, persistWebhookEvent } from '@vesta/shared/server/adapters/webhooks'

export async function POST(request: Request): Promise<Response> {
  try {
    if (!validateWebhookSource(request)) {
      throw new ApiError(403, 'Forbidden: unknown webhook source', 'FORBIDDEN')
    }

    const payload = await request.json() as {
      sourceAddress: string
      message: string
      messageId: string
      timeStamp: string
    }

    await persistWebhookEvent('SMS_RECEIVE', payload, payload.messageId)

    return Response.json({ statusCode: 'S1000', statusDetail: 'Received' })
  } catch (error) {
    return handleApiError(error)
  }
}
