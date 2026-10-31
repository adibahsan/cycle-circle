import { prisma } from '../db'

// SMS settings kept in SystemSetting (key/value). Times are Bangladesh time (UTC+6, no DST).

export const SMS_SEND_TIME_KEY = 'sms.dailySendTime'

/** Used until an admin sets one: 14:00 Bangladesh time = 08:00 UTC, when the daily cron used to run. */
export const DEFAULT_SMS_SEND_TIME = '14:00'

const SEND_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** `HH:MM`, 24-hour, zero padded. */
export function isValidSmsSendTime(value: unknown): value is string {
  return typeof value === 'string' && SEND_TIME_RE.test(value)
}

/** The instant `HH:MM` Bangladesh time on a Bangladesh `day` (`YYYY-MM-DD`). */
export function smsSendMoment(day: string, sendTime: string): Date {
  return new Date(`${day}T${sendTime}:00.000+06:00`)
}

/** The daily send time as `HH:MM` Bangladesh time. An absent or corrupt value gives the default. */
export async function getSmsSendTime(): Promise<string> {
  const row = await prisma.systemSetting.findUnique({ where: { key: SMS_SEND_TIME_KEY }, select: { value: true } })
  return isValidSmsSendTime(row?.value) ? row.value : DEFAULT_SMS_SEND_TIME
}

/** Set the daily send time (`HH:MM`, Bangladesh time). Returns the previous and new values. */
export async function setSmsSendTime(time: string, adminId?: string) {
  if (!isValidSmsSendTime(time)) throw new Error('Send time must be HH:MM in 24-hour time (for example 14:00)')
  const previous = await getSmsSendTime()
  await prisma.systemSetting.upsert({
    where: { key: SMS_SEND_TIME_KEY },
    create: { key: SMS_SEND_TIME_KEY, value: time, updatedBy: adminId },
    update: { value: time, updatedBy: adminId },
  })
  return { previous, time }
}

// ── Delivery reports ───────────────────────────────────────────────────────────

export const SMS_DELIVERY_REPORTS_KEY = 'sms.deliveryReports'

/**
 * Whether sends ask BDApps for delivery reports. Off until an admin turns it on: our BDApps SMS
 * plan has reports disabled and BDApps rejects the whole send with E1312 when they are requested.
 * An absent or corrupt value means off.
 */
export async function getSmsDeliveryReports(): Promise<boolean> {
  const row = await prisma.systemSetting.findUnique({ where: { key: SMS_DELIVERY_REPORTS_KEY }, select: { value: true } })
  return row?.value === 'on'
}

/** Turn delivery reports on or off. Returns the previous and new values. */
export async function setSmsDeliveryReports(enabled: boolean, adminId?: string) {
  const previous = await getSmsDeliveryReports()
  const value = enabled ? 'on' : 'off'
  await prisma.systemSetting.upsert({
    where: { key: SMS_DELIVERY_REPORTS_KEY },
    create: { key: SMS_DELIVERY_REPORTS_KEY, value, updatedBy: adminId },
    update: { value, updatedBy: adminId },
  })
  return { previous, enabled }
}
