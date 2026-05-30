import type { Language } from '@prisma/client'
import { getEmailLogById } from './services/email-service'
import {
  periodAlertEmail,
  fertileWindowEmail,
  loggingReminderEmail,
} from './email-templates'
import { buildMagicLinkEmailHtml } from './magic-link-email'

export type EmailLogPreviewResult = {
  html: string
  subject: string
  isApproximate: true
}

function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function displayNameFromLog(
  user: { fullName: string | null; email: string | null } | null,
  to: string,
): string {
  if (user?.fullName) return user.fullName
  const local = to.split('@')[0]
  return local || 'User'
}

function languageFromUser(lang: Language | undefined | null): Language {
  return lang === 'BN' ? 'BN' : 'EN'
}

export async function renderEmailLogPreview(
  logId: string,
): Promise<EmailLogPreviewResult | null> {
  const log = await getEmailLogById(logId)
  if (!log) return null

  const language = languageFromUser(log.user?.language)
  const userName = displayNameFromLog(log.user, log.to)
  const profileName = log.profile?.name ?? userName
  const sentAt = log.sentAt

  switch (log.type) {
    case 'PERIOD_ALERT': {
      const { html, subject } = periodAlertEmail({
        userName,
        profileName,
        language,
        predictedDate: formatDateOnly(sentAt),
        daysUntil: 2,
      })
      return { html, subject, isApproximate: true }
    }
    case 'FERTILE_ALERT': {
      const fertileStart = formatDateOnly(sentAt)
      const fertileEnd = formatDateOnly(addDays(sentAt, 6))
      const ovulationDate = formatDateOnly(addDays(sentAt, 3))
      const { html, subject } = fertileWindowEmail({
        userName,
        profileName,
        language,
        fertileStart,
        fertileEnd,
        ovulationDate,
      })
      return { html, subject, isApproximate: true }
    }
    case 'LOGGING_REMINDER': {
      const { html, subject } = loggingReminderEmail({
        userName,
        profileName,
        language,
        daysSinceLastLog: 5,
      })
      return { html, subject, isApproximate: true }
    }
    case 'MAGIC_LINK': {
      const lang = language === 'BN' ? 'bn' : 'en'
      const { html, subject } = buildMagicLinkEmailHtml(
        '[link expired — not stored]',
        lang,
      )
      return { html, subject, isApproximate: true }
    }
    default:
      return null
  }
}
