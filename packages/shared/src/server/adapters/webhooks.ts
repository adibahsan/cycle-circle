import { env } from '../../utils/env'
import { prisma } from '../db'
import type { WebhookEvent, WebhookType } from '@prisma/client'

/**
 * Validate that the incoming webhook request originates from a known BDApps
 * IP address.
 *
 * When `BDAPPS_WEBHOOK_IPS` is not configured (e.g. in local development),
 * all sources are accepted. In production, set the variable to a
 * comma-separated list of trusted IPs.
 */
export function validateWebhookSource(request: Request): boolean {
  const allowedIps =
    env.BDAPPS_WEBHOOK_IPS?.split(',').map((s) => s.trim()).filter(Boolean) ??
    []

  // No whitelist configured — allow all (development / staging without IP pinning)
  if (allowedIps.length === 0) return true

  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() ?? ''

  return allowedIps.includes(ip)
}

export interface PersistResult {
  duplicate: boolean
  event: WebhookEvent
}

/**
 * Persist a webhook payload, deduplicating by `idempotencyKey`.
 *
 * Returns `{ duplicate: true }` when the key has been seen before so the
 * caller can return HTTP 200 without reprocessing.
 */
export async function persistWebhookEvent(
  type: WebhookType,
  payload: unknown,
  idempotencyKey: string,
): Promise<PersistResult> {
  const existing = await prisma.webhookEvent.findUnique({
    where: { idempotencyKey },
  })

  if (existing) return { duplicate: true, event: existing }

  const event = await prisma.webhookEvent.create({
    data: {
      type,
      // Prisma expects `Json` — cast to `any` to avoid circular type gymnastics
      payload: payload as Parameters<typeof prisma.webhookEvent.create>[0]['data']['payload'],
      idempotencyKey,
    },
  })

  return { duplicate: false, event }
}
