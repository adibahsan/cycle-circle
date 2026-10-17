import { smsSend } from './bdapps'
import { sendEmail } from './mail'
import { logger } from '../log'
import {
  periodAlertEmail,
  fertileWindowEmail,
  loggingReminderEmail,
  profileCompletionReminderEmail,
} from '../email-templates'
import type { Language } from '@prisma/client'

// ─── Period Alert ─────────────────────────────────────────────────────────────

export async function sendPeriodAlert(params: {
  email?: string | null
  phone?: string | null
  userName: string
  profileName: string
  language: Language
  predictedDate: string
  daysUntil: number
  isProSubscriber: boolean
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

  // SMS: only Pro subscribers with a phone number
  if (params.isProSubscriber && params.phone) {
    const smsText =
      params.language === 'BN'
        ? `সাইকেল সার্কেল: ${params.profileName} এর পিরিয়ড ${params.daysUntil} দিনের মধ্যে (${params.predictedDate})`
        : `Cycle Circle: ${params.profileName}'s period expected in ${params.daysUntil} days (${params.predictedDate})`
    await smsSend(smsText, [params.phone]).catch((err) =>
      logger.error('notification.sms.failed', err, { alert: 'Period alert' }),
    )
  }
}

// ─── Fertile Window Alert ─────────────────────────────────────────────────────

export async function sendFertileAlert(params: {
  email?: string | null
  phone?: string | null
  userName: string
  profileName: string
  language: Language
  fertileStart: string
  fertileEnd: string
  ovulationDate: string
  isProSubscriber: boolean
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

  // SMS: only Pro subscribers with a phone number
  if (params.isProSubscriber && params.phone) {
    const smsText =
      params.language === 'BN'
        ? `সাইকেল সার্কেল: ${params.profileName} এর উর্বর সময় আজ শুরু (${params.fertileStart} - ${params.fertileEnd})`
        : `Cycle Circle: ${params.profileName}'s fertile window starts today (${params.fertileStart} - ${params.fertileEnd})`
    await smsSend(smsText, [params.phone]).catch((err) =>
      logger.error('notification.sms.failed', err, { alert: 'Fertile alert' }),
    )
  }
}

// ─── Logging Reminder ─────────────────────────────────────────────────────────

export async function sendLoggingReminder(params: {
  email?: string | null
  phone?: string | null
  userName: string
  profileName: string
  language: Language
  daysSinceLastLog: number
  isProSubscriber: boolean
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

  // SMS: only Pro subscribers with a phone number
  if (params.isProSubscriber && params.phone) {
    const smsText =
      params.language === 'BN'
        ? `সাইকেল সার্কেল: ${params.profileName} এর সাইকেল লগ করতে ভুলবেন না। শেষ লগের পর ${params.daysSinceLastLog} দিন হয়েছে।`
        : `Cycle Circle: Don't forget to log ${params.profileName}'s cycle. Last logged ${params.daysSinceLastLog} days ago.`
    await smsSend(smsText, [params.phone]).catch((err) =>
      logger.error('notification.sms.failed', err, { alert: 'Logging reminder' }),
    )
  }
}

// ─── Profile Completion Reminder ──────────────────────────────────────────────

export async function sendProfileCompletionReminder(params: {
  id: string
  email?: string | null
  phone?: string | null
  fullName?: string | null
  language: Language
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

  // SMS: any user with a phone number (not Pro-gated)
  if (params.phone) {
    const smsText =
      params.language === 'BN'
        ? `সাইকেল সার্কেল: ${userName}, আপনার প্রোফাইল সেটআপ এখনো শেষ হয়নি। অ্যাপে প্রবেশ করুন এবং সম্পূর্ণ করুন।`
        : `Cycle Circle: ${userName}, your profile setup isn't complete yet. Open the app to finish setting up.`
    await smsSend(smsText, [params.phone]).catch((err) =>
      logger.error('notification.sms.failed', err, { alert: 'Profile completion reminder' }),
    )
  }
}
