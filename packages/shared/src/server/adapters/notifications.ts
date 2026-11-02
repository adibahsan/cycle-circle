import { isUnregisteredError, smsSend } from './bdapps'
import { sendEmail } from './mail'
import { logger } from '../log'
import {
  periodAlertEmail,
  fertileWindowEmail,
  loggingReminderEmail,
  profileCompletionReminderEmail,
} from '../email-templates'
import type { Language } from '@prisma/client'

// ─── Reminder SMS ─────────────────────────────────────────────────────────────

/**
 * Sends one reminder SMS to the User's masked BDApps subscriber id (ADR 0002, 2026-10-18:
 * BDApps rejects raw numbers with E1951). Without a masked id there is nothing to send to.
 * E1951 means the subscriber is unregistered, which is expected, not a failure.
 * Skips go to the cron channel (the reminder run's own channel); real failures to error.
 */
async function sendReminderSms(
  text: string,
  smsTo: string | null,
  alert: string,
  userId?: string,
): Promise<void> {
  if (!smsTo) {
    logger.cron('notification.sms.skipped', { alert, reason: 'no-masked-id' }, { level: 'info', userId })
    return
  }
  try {
    await smsSend(text, [smsTo])
  } catch (err) {
    if (isUnregisteredError(err)) {
      logger.cron('notification.sms.skipped', { alert, reason: 'unregistered' }, { level: 'warn', userId })
    } else {
      logger.error('notification.sms.failed', err, { alert })
    }
  }
}

// ─── Period Alert ─────────────────────────────────────────────────────────────

export async function sendPeriodAlert(params: {
  email?: string | null
  userName: string
  profileName: string
  language: Language
  predictedDate: string
  daysUntil: number
  /** Masked BDApps subscriber id, or null when the User has none. */
  smsTo: string | null
  userId?: string
  profileId?: string
}): Promise<void> {
  const { subject, html } = periodAlertEmail(params)

  // Email: all users with an email address
  if (params.email) {
    await sendEmail(params.email, subject, html, {
      type: 'PERIOD_ALERT',
      userId: params.userId,
      profileId: params.profileId,
    }).catch((err) => logger.error('notification.email.failed', err, { alert: 'Period alert' }))
  }

  // SMS: the masked subscriber id only; skipped when the User has none
  const smsText =
    params.language === 'BN'
      ? `সাইকেল সার্কেল: ${params.profileName} এর পিরিয়ড ${params.daysUntil} দিনের মধ্যে (${params.predictedDate})`
      : `Cycle Circle: ${params.profileName}'s period expected in ${params.daysUntil} days (${params.predictedDate})`
  await sendReminderSms(smsText, params.smsTo, 'Period alert', params.userId)
}

// ─── Fertile Window Alert ─────────────────────────────────────────────────────

export async function sendFertileAlert(params: {
  email?: string | null
  userName: string
  profileName: string
  language: Language
  fertileStart: string
  fertileEnd: string
  ovulationDate: string
  /** Masked BDApps subscriber id, or null when the User has none. */
  smsTo: string | null
  userId?: string
  profileId?: string
}): Promise<void> {
  const { subject, html } = fertileWindowEmail(params)

  // Email: all users with an email address
  if (params.email) {
    await sendEmail(params.email, subject, html, {
      type: 'FERTILE_ALERT',
      userId: params.userId,
      profileId: params.profileId,
    }).catch((err) => logger.error('notification.email.failed', err, { alert: 'Fertile alert' }))
  }

  // SMS: the masked subscriber id only; skipped when the User has none
  const smsText =
    params.language === 'BN'
      ? `সাইকেল সার্কেল: ${params.profileName} এর উর্বর সময় আজ শুরু (${params.fertileStart} - ${params.fertileEnd})`
      : `Cycle Circle: ${params.profileName}'s fertile window starts today (${params.fertileStart} - ${params.fertileEnd})`
  await sendReminderSms(smsText, params.smsTo, 'Fertile alert', params.userId)
}

// ─── Logging Reminder ─────────────────────────────────────────────────────────

export async function sendLoggingReminder(params: {
  email?: string | null
  userName: string
  profileName: string
  language: Language
  daysSinceLastLog: number
  /** Masked BDApps subscriber id, or null when the User has none. */
  smsTo: string | null
  userId?: string
  profileId?: string
}): Promise<void> {
  const { subject, html } = loggingReminderEmail(params)

  // Email: all users with an email address
  if (params.email) {
    await sendEmail(params.email, subject, html, {
      type: 'LOGGING_REMINDER',
      userId: params.userId,
      profileId: params.profileId,
    }).catch((err) => logger.error('notification.email.failed', err, { alert: 'Logging reminder' }))
  }

  // SMS: the masked subscriber id only; skipped when the User has none
  const smsText =
    params.language === 'BN'
      ? `সাইকেল সার্কেল: ${params.profileName} এর সাইকেল লগ করতে ভুলবেন না। শেষ লগের পর ${params.daysSinceLastLog} দিন হয়েছে।`
      : `Cycle Circle: Don't forget to log ${params.profileName}'s cycle. Last logged ${params.daysSinceLastLog} days ago.`
  await sendReminderSms(smsText, params.smsTo, 'Logging reminder', params.userId)
}

// ─── Profile Completion Reminder ──────────────────────────────────────────────

export async function sendProfileCompletionReminder(params: {
  id: string
  email?: string | null
  fullName?: string | null
  language: Language
  /** Masked BDApps subscriber id, or null when the User has none. */
  smsTo: string | null
  userId: string
}): Promise<void> {
  const userName = params.fullName ?? 'User'
  const { subject, html } = profileCompletionReminderEmail({
    userName,
    language: params.language,
  })

  // Email: all users with an email address (not Pro-gated)
  if (params.email) {
    await sendEmail(params.email, subject, html, {
      type: 'PROFILE_COMPLETION_REMINDER',
      userId: params.userId,
    }).catch((err) => logger.error('notification.email.failed', err, { alert: 'Profile completion reminder' }))
  }

  // SMS: the masked subscriber id only; skipped when the User has none
  const smsText =
    params.language === 'BN'
      ? `সাইকেল সার্কেল: ${userName}, আপনার প্রোফাইল সেটআপ এখনো শেষ হয়নি। অ্যাপে প্রবেশ করুন এবং সম্পূর্ণ করুন।`
      : `Cycle Circle: ${userName}, your profile setup isn't complete yet. Open the app to finish setting up.`
  await sendReminderSms(smsText, params.smsTo, 'Profile completion reminder', params.userId)
}
