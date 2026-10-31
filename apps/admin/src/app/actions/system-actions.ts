'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminAuth, getAuthUser } from '@vesta/shared/server/auth'
import {
  AUDIT_ACTIONS,
  createAuditLog,
  getCronSettings,
  setCronEnabled,
  type CronSlug,
} from '@vesta/shared/server/services'

export type { CronSlug } from '@vesta/shared/server/services'

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
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrideDisabled: true }),
      cache: 'no-store',
    })
    // The cron JSON can include non-numeric fields (e.g. daily-reminders'
    // `smsBroadcast` object). Keep only numeric entries so the counts contract
    // holds and the admin UI never tries to render an object as a React child.
    const raw = (await res.json().catch(() => undefined)) as Record<string, unknown> | undefined
    const counts = raw
      ? (Object.fromEntries(
          Object.entries(raw).filter(([, v]) => typeof v === 'number'),
        ) as Record<string, number>)
      : undefined
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
  return runJob('daily-reminders', AUDIT_ACTIONS.TRIGGER_CRON_DAILY_REMINDERS)
}

export async function triggerCaasCheck(): Promise<CronJobResult> {
  return runJob('caas-check', AUDIT_ACTIONS.TRIGGER_CRON_CAAS_CHECK)
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
      body: JSON.stringify({ userId, force: true, overrideDisabled: true }),
      cache: 'no-store',
    })
    // The cron JSON can include non-numeric fields (e.g. daily-reminders'
    // `smsBroadcast` object). Keep only numeric entries so the counts contract
    // holds and the admin UI never tries to render an object as a React child.
    const raw = (await res.json().catch(() => undefined)) as Record<string, unknown> | undefined
    const counts = raw
      ? (Object.fromEntries(
          Object.entries(raw).filter(([, v]) => typeof v === 'number'),
        ) as Record<string, number>)
      : undefined
    await createAuditLog(
      admin.id,
      AUDIT_ACTIONS.SEND_USER_REMINDERS,
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

export async function getCronSettingsAction(): Promise<Record<CronSlug, boolean>> {
  await requireAdminAuth()
  return getCronSettings()
}

export async function setCronEnabledAction(
  slug: CronSlug,
  enabled: boolean,
): Promise<{ ok: boolean; enabled: boolean; error?: string }> {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)
  try {
    await setCronEnabled(slug, enabled, admin.id)
    await createAuditLog(admin.id, AUDIT_ACTIONS.SET_CRON_ENABLED, 'CronJob', slug, { enabled })
    revalidatePath('/system')
    return { ok: true, enabled }
  } catch (e) {
    return { ok: false, enabled: !enabled, error: e instanceof Error ? e.message : 'Failed to update' }
  }
}
