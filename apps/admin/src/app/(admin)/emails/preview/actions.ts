'use server'

import {
  periodAlertEmail,
  fertileWindowEmail,
  loggingReminderEmail,
} from '@vesta/shared/server/email-templates'

type TemplateKey = 'period-alert' | 'fertile-window' | 'logging-reminder'
type Language = 'en' | 'bn'

export async function getEmailPreviewHtml(
  template: TemplateKey,
  language: Language,
): Promise<string> {
  const lang = language === 'en' ? 'EN' : ('BN' as const)

  switch (template) {
    case 'period-alert': {
      const { html } = periodAlertEmail({
        userName: 'Fatima',
        profileName: 'Fatima',
        language: lang,
        predictedDate: '2026-06-15',
        daysUntil: 2,
      })
      return html
    }

    case 'fertile-window': {
      const { html } = fertileWindowEmail({
        userName: 'Fatima',
        profileName: 'Fatima',
        language: lang,
        fertileStart: '2026-06-20',
        fertileEnd: '2026-06-26',
        ovulationDate: '2026-06-23',
      })
      return html
    }

    case 'logging-reminder': {
      const { html } = loggingReminderEmail({
        userName: 'Fatima',
        profileName: 'Fatima',
        language: lang,
        daysSinceLastLog: 5,
      })
      return html
    }

    default:
      return ''
  }
}
