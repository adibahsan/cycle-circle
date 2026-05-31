'use server'

import { requireAdminAuth } from '@vesta/shared/server/auth'
import {
  getEmailLogById,
  updateEmailDeliveryStatus,
} from '@vesta/shared/server/services'
import { revalidateTag } from 'next/cache'
import { adminCacheTags } from '@/lib/admin-cache-tags'

type DeliveryStatusValue = 'PENDING' | 'DELIVERED' | 'BOUNCED' | 'COMPLAINED' | 'DELAYED'

const RESEND_EVENT_MAP: Record<string, DeliveryStatusValue> = {
  delivered: 'DELIVERED',
  bounced: 'BOUNCED',
  complained: 'COMPLAINED',
  delivery_delayed: 'DELAYED',
  sent: 'PENDING',
}

export async function refreshEmailDeliveryStatus(emailLogId: string): Promise<{
  deliveryStatus: string
  error?: string
}> {
  await requireAdminAuth()

  const log = await getEmailLogById(emailLogId)
  if (!log?.resendId) {
    return {
      deliveryStatus: log?.deliveryStatus ?? 'PENDING',
      error: 'No Resend ID on this log',
    }
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return {
      deliveryStatus: log.deliveryStatus ?? 'PENDING',
      error: 'RESEND_API_KEY not set',
    }
  }

  const res = await fetch(`https://api.resend.com/emails/${log.resendId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    return {
      deliveryStatus: log.deliveryStatus ?? 'PENDING',
      error: `Resend API error: ${res.status}`,
    }
  }

  const data = (await res.json()) as { last_event?: string }
  const mapped = RESEND_EVENT_MAP[data.last_event ?? ''] ?? 'PENDING'

  await updateEmailDeliveryStatus(log.resendId, mapped)
  revalidateTag(adminCacheTags.emails, { expire: 0 })

  return { deliveryStatus: mapped }
}
