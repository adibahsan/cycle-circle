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

  // Prefer x-real-ip (set by the reverse proxy / Vercel edge, not by the client).
  // Fall back to the first entry of x-forwarded-for only when x-real-ip is absent.
  // If neither header is present, reject the request — we cannot verify the source.
  const realIp = request.headers.get('x-real-ip')?.trim()
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = realIp ?? forwarded?.split(',')[0]?.trim()

  if (!ip) return false

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
