'use server'

import { requireAdminAuth, getAuthUser } from '@vesta/shared/server/auth'
import { createAuditLog } from '@vesta/shared/server/services'

export type CronJobResult = {
  ok: boolean
  counts?: Record<string, number>
  error?: string
}

async function runJob(
  slug: 'daily-reminders' | 'caas-check',
  action: string,
): Promise<CronJobResult> {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  const base = process.env.APP_URL
  const secret = process.env.CRON_SECRET
  if (!base || !secret) {
    return { ok: false, error: 'APP_URL or CRON_SECRET is not configured for the admin app' }
  }

  try {
    const res = await fetch(`${base}/api/cron/${slug}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
      cache: 'no-store',
    })
    const counts = (await res.json().catch(() => undefined)) as Record<string, number> | undefined
    await createAuditLog(
      admin.id,
      action,
      'CronJob',
      slug,
      res.ok ? { counts: counts ?? {} } : { status: res.status },
    )
    if (!res.ok) {
      return { ok: false, error: `Web app returned ${res.status}`, counts }
    }
    return { ok: true, counts }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Request failed' }
  }
}

export async function triggerDailyReminders(): Promise<CronJobResult> {
  return runJob('daily-reminders', 'TRIGGER_CRON_DAILY_REMINDERS')
}

export async function triggerCaasCheck(): Promise<CronJobResult> {
  return runJob('caas-check', 'TRIGGER_CRON_CAAS_CHECK')
}

export async function sendUserReminders(userId: string): Promise<CronJobResult> {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  const base = process.env.APP_URL
  const secret = process.env.CRON_SECRET
  if (!base || !secret) {
    return { ok: false, error: 'APP_URL or CRON_SECRET is not configured for the admin app' }
  }

  try {
    const res = await fetch(`${base}/api/cron/daily-reminders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, force: true }),
      cache: 'no-store',
    })
    const counts = (await res.json().catch(() => undefined)) as Record<string, number> | undefined
    await createAuditLog(
      admin.id,
      'SEND_USER_REMINDERS',
      'User',
      userId,
      res.ok ? { counts: counts ?? {} } : { status: res.status },
    )
    if (!res.ok) {
      return { ok: false, error: `Web app returned ${res.status}`, counts }
    }
    return { ok: true, counts }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Request failed' }
  }
}
