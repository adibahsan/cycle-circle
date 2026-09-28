import { handleApiError, ApiError } from '@vesta/shared/server/api-error'
import { validateWebhookSource, persistWebhookEvent } from '@vesta/shared/server/adapters/webhooks'

export async function POST(request: Request): Promise<Response> {
  try {
    if (!validateWebhookSource(request)) {
      throw new ApiError(401, 'Unauthorized: unknown webhook source', 'UNAUTHORIZED')
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
