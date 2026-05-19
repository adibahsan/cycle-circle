import { handleApiError, ApiError } from '@/lib/server/api-error'
import { validateWebhookSource, persistWebhookEvent } from '@/lib/server/adapters/webhooks'

export async function POST(request: Request): Promise<Response> {
  try {
    if (!validateWebhookSource(request)) {
      throw new ApiError(403, 'Forbidden: unknown webhook source', 'FORBIDDEN')
    }

    const payload = await request.json() as {
      destinationAddress: string
      requestId: string
      deliveryStatus: string
      timeStamp: string
    }

    await persistWebhookEvent('SMS_REPORT', payload, payload.requestId)

    return Response.json({ statusCode: 'S1000', statusDetail: 'Received' })
  } catch (error) {
    return handleApiError(error)
  }
}
