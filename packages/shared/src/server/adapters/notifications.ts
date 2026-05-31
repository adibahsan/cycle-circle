import { smsSend } from './bdapps'
import { sendEmail } from './mail'
import {
  periodAlertEmail,
  fertileWindowEmail,
  loggingReminderEmail,
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
    })
  }

  // SMS: only Pro subscribers with a phone number
  if (params.isProSubscriber && params.phone) {
    const smsText =
      params.language === 'BN'
        ? `ভেস্তা: ${params.profileName} এর পিরিয়ড ${params.daysUntil} দিনের মধ্যে (${params.predictedDate})`
        : `Vesta: ${params.profileName}'s period expected in ${params.daysUntil} days (${params.predictedDate})`
    await smsSend(smsText, [params.phone]).catch((err) =>
      console.error('[SMS] Period alert failed:', err),
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
    })
  }

  // SMS: only Pro subscribers with a phone number
  if (params.isProSubscriber && params.phone) {
    const smsText =
      params.language === 'BN'
        ? `ভেস্তা: ${params.profileName} এর উর্বর সময় আজ শুরু (${params.fertileStart} - ${params.fertileEnd})`
        : `Vesta: ${params.profileName}'s fertile window starts today (${params.fertileStart} - ${params.fertileEnd})`
    await smsSend(smsText, [params.phone]).catch((err) =>
      console.error('[SMS] Fertile alert failed:', err),
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
    })
  }

  // SMS: only Pro subscribers with a phone number
  if (params.isProSubscriber && params.phone) {
    const smsText =
      params.language === 'BN'
        ? `ভেস্তা: ${params.profileName} এর সাইকেল লগ করতে ভুলবেন না। শেষ লগের পর ${params.daysSinceLastLog} দিন হয়েছে।`
        : `Vesta: Don't forget to log ${params.profileName}'s cycle. Last logged ${params.daysSinceLastLog} days ago.`
    await smsSend(smsText, [params.phone]).catch((err) =>
      console.error('[SMS] Logging reminder failed:', err),
    )
  }
}
