import { handleApiError, ApiError } from '@/lib/server/api-error'
import { validateWebhookSource, persistWebhookEvent } from '@/lib/server/adapters/webhooks'

export async function POST(request: Request): Promise<Response> {
  try {
    if (!validateWebhookSource(request)) {
      throw new ApiError(403, 'Forbidden: unknown webhook source', 'FORBIDDEN')
    }

    const payload = await request.json() as {
      subscriberId: string
      ussdContent: string
      sessionId: string
      status: string
    }

    await persistWebhookEvent('USSD_RECEIVE', payload, payload.sessionId)

    return Response.json({ statusCode: 'S1000', statusDetail: 'Received' })
  } catch (error) {
    return handleApiError(error)
  }
}
