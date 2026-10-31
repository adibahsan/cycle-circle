'use server'

import { revalidatePath } from 'next/cache'
import { revalidateWebTags } from '@/lib/revalidate-web'
import { requireAdminAuth, getAuthUser } from '@vesta/shared/server/auth'
import {
  AUDIT_ACTIONS,
  createAuditLog,
  getCronSettings,
  setCronEnabled,
  setSmsSendTime,
  setSmsDeliveryReports,
  setProPrice,
  type ProPriceEntry,
  type ProPricePeriod,
  SMS_SEND_TIME_KEY,
  SMS_DELIVERY_REPORTS_KEY,
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

/** Set the daily SMS send time (`HH:MM`, Bangladesh time). Audited. */
export async function setSmsSendTimeAction(
  time: string,
): Promise<{ ok: true; time: string } | { ok: false; error: string }> {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)
  try {
    const { previous } = await setSmsSendTime(time, admin.id)
    await createAuditLog(admin.id, AUDIT_ACTIONS.SET_SMS_SEND_TIME, 'SystemSetting', SMS_SEND_TIME_KEY, {
      from: previous,
      to: time,
      timezone: 'Asia/Dhaka',
    })
    revalidatePath('/system')
    return { ok: true, time }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to update' }
  }
}

/** Turn BDApps delivery reports for SMS sends on or off. Audited. Applies to messages sent after the change. */
export async function setSmsDeliveryReportsAction(
  enabled: boolean,
): Promise<{ ok: true; enabled: boolean } | { ok: false; error: string }> {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)
  try {
    const { previous } = await setSmsDeliveryReports(enabled, admin.id)
    await createAuditLog(admin.id, AUDIT_ACTIONS.SET_SMS_DELIVERY_REPORTS, 'SystemSetting', SMS_DELIVERY_REPORTS_KEY, {
      from: previous,
      to: enabled,
    })
    revalidatePath('/system')
    return { ok: true, enabled }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to update' }
  }
}

/**
 * Set the Pro price (taka and period) from a Bangladesh day. Audited by the service. This does not
 * change what BDApps charges.
 */
export async function setProPriceAction(input: {
  amount: number
  period: ProPricePeriod
  effectiveFrom: string
}): Promise<{ ok: true; entry: ProPriceEntry; webCacheRefreshed: boolean } | { ok: false; error: string }> {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)
  try {
    const entry = await setProPrice(admin.id, input, new Date())
    revalidatePath('/system')
    // The web app caches the price for customers; bust it so the new price shows without a deploy.
    const webCacheRefreshed = await revalidateWebTags(['pro-price'])
    return { ok: true, entry, webCacheRefreshed }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to update' }
  }
}
