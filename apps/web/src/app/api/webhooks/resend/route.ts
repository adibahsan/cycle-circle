import { updateEmailDeliveryStatus } from '@vesta/shared/server/services'
import type { DeliveryStatus } from '@prisma/client'
import { withRequestContext, logger } from '@vesta/shared/server/log'

type ResendEventType =
  | 'email.delivered'
  | 'email.bounced'
  | 'email.complained'
  | 'email.delivery_delayed'

interface ResendWebhookPayload {
  type: ResendEventType
  data: {
    email_id: string
    [key: string]: unknown
  }
}

const EVENT_TO_DELIVERY_STATUS: Record<ResendEventType, DeliveryStatus> = {
  'email.delivered': 'DELIVERED',
  'email.bounced': 'BOUNCED',
  'email.complained': 'COMPLAINED',
  'email.delivery_delayed': 'DELAYED',
}

async function verifySignature(
  request: Request,
  body: string,
  secret: string,
): Promise<boolean> {
  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) return false

  // Construct the signed content per Svix spec: id.timestamp.body
  const signedContent = `${svixId}.${svixTimestamp}.${body}`

  const encoder = new TextEncoder()
  const keyData = Uint8Array.from(
    atob(secret.startsWith('whsec_') ? secret.slice(6) : secret),
    (c) => c.charCodeAt(0),
  )

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(signedContent),
  )

  const computedBase64 = btoa(
    String.fromCharCode(...new Uint8Array(signature)),
  )

  // svix-signature may contain multiple comma-separated "v1,<base64>" values
  const signatures = svixSignature
    .split(' ')
    .map((s) => s.replace(/^v1,/, ''))

  return signatures.some((sig) => sig === computedBase64)
}

export async function POST(request: Request) {
  return withRequestContext(async () => {
  try {
    const rawBody = await request.text()

    // Verify signature when secret is configured
    const secret = process.env.RESEND_WEBHOOK_SECRET
    if (secret) {
      const valid = await verifySignature(request, rawBody, secret)
      if (!valid) {
        logger.webhook('resend.event', { action: 'rejected', reason: 'invalid-signature', body: rawBody }, { level: 'warn' })
        return new Response('Unauthorized: invalid signature', { status: 401 })
      }
    } else {
      // Dev mode: require headers to at least be present as a basic sanity check
      const hasHeaders =
        request.headers.get('svix-id') &&
        request.headers.get('svix-timestamp') &&
        request.headers.get('svix-signature')
      if (!hasHeaders) {
        logger.webhook('resend.event', { action: 'rejected', reason: 'missing-svix-headers', body: rawBody }, { level: 'warn' })
        return new Response('Bad Request: missing svix headers', {
          status: 400,
        })
      }
    }

    let payload: ResendWebhookPayload
    try {
      payload = JSON.parse(rawBody) as ResendWebhookPayload
    } catch {
      logger.webhook('resend.event', { action: 'rejected', reason: 'invalid-json', body: rawBody }, { level: 'warn' })
      return new Response('Bad Request: invalid JSON', { status: 400 })
    }

    const { type, data } = payload

    const deliveryStatus = EVENT_TO_DELIVERY_STATUS[type]
    if (!deliveryStatus) {
      // Unknown event type — acknowledge without processing
      logger.webhook('resend.event', { payload, action: 'ignored', reason: 'unhandled-type' })
      return new Response('OK', { status: 200 })
    }

    const emailId = data?.email_id
    if (!emailId) {
      logger.webhook('resend.event', { payload, action: 'rejected', reason: 'missing-email-id' }, { level: 'warn' })
      return new Response('Bad Request: missing email_id', { status: 400 })
    }

    // updateEmailDeliveryStatus uses updateMany so it's a no-op when the
    // emailLog doesn't exist — Resend still gets a 2xx and won't retry.
    await updateEmailDeliveryStatus(emailId, deliveryStatus)
    logger.webhook('resend.event', { payload, action: 'updated', deliveryStatus })

    return new Response('OK', { status: 200 })
  } catch (error) {
    logger.error('resend.webhook', error)
    return new Response('Internal Server Error', { status: 500 })
  }
  }, { requestId: request.headers.get('x-request-id') ?? undefined })
}
