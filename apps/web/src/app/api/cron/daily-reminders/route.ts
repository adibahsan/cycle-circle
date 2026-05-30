import { differenceInDays } from 'date-fns'
import { withCronAuth } from '@vesta/shared/server/middleware'
import { getProfilesForReminders, wasEmailSentToday } from '@vesta/shared/server/services'
import {
  sendPeriodAlert,
  sendFertileAlert,
  sendLoggingReminder,
} from '@vesta/shared/server/adapters/notifications'

/**
 * POST /api/cron/daily-reminders
 *
 * Runs at 08:00 UTC every day. Sends period alerts, fertile-window alerts,
 * and logging reminders to users who have the relevant preferences enabled.
 *
 * Protected by withCronAuth (Authorization: Bearer <CRON_SECRET>).
 */
export const POST = withCronAuth(async () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let periodAlerts = 0
  let fertileAlerts = 0
  let reminders = 0
  let errors = 0
  let skipped = 0

  const profilesWithData = await getProfilesForReminders()

  for (const profile of profilesWithData) {
    const prefs = profile.notificationPref
    if (!prefs) continue

    const { user } = profile
    const isProSubscriber = user.subscriptionStatus === 'PRO'
    const { language } = user

    const prediction = profile.predictions[0] ?? null

    try {
      if (prefs.periodAlert && prediction) {
        const daysUntil = differenceInDays(prediction.nextPeriodStart, today)
        if (daysUntil >= 0 && daysUntil <= 2) {
          if (await wasEmailSentToday('PERIOD_ALERT', profile.id)) {
            skipped++
          } else {
            await sendPeriodAlert({
              email: user.email,
              phone: user.phone,
              userName: user.fullName ?? 'User',
              profileName: profile.name,
              language,
              predictedDate: prediction.nextPeriodStart
                .toISOString()
                .split('T')[0]!,
              daysUntil,
              isProSubscriber,
              userId: user.id,
              profileId: profile.id,
            })
            periodAlerts++
          }
        }
      }

      if (prefs.fertileWindow && prediction) {
        const fertileStartDiff = differenceInDays(prediction.fertileStart, today)
        if (fertileStartDiff === 0) {
          if (await wasEmailSentToday('FERTILE_ALERT', profile.id)) {
            skipped++
          } else {
            await sendFertileAlert({
              email: user.email,
              phone: user.phone,
              userName: user.fullName ?? 'User',
              profileName: profile.name,
              language,
              fertileStart: prediction.fertileStart
                .toISOString()
                .split('T')[0]!,
              fertileEnd: prediction.fertileEnd.toISOString().split('T')[0]!,
              ovulationDate: prediction.ovulationDay
                .toISOString()
                .split('T')[0]!,
              isProSubscriber,
              userId: user.id,
              profileId: profile.id,
            })
            fertileAlerts++
          }
        }
      }

      if (prefs.loggingReminder) {
        const lastLog = profile.periodLogs[0] ?? null
        const daysSince = lastLog
          ? differenceInDays(today, lastLog.startDate)
          : 999
        if (daysSince >= 3) {
          if (await wasEmailSentToday('LOGGING_REMINDER', profile.id)) {
            skipped++
          } else {
            await sendLoggingReminder({
              email: user.email,
              phone: user.phone,
              userName: user.fullName ?? 'User',
              profileName: profile.name,
              language,
              daysSinceLastLog: daysSince,
              isProSubscriber,
              userId: user.id,
              profileId: profile.id,
            })
            reminders++
          }
        }
      }
    } catch (err) {
      console.error(
        `[cron/daily-reminders] Notification error for profile ${profile.id}:`,
        err,
      )
      errors++
    }
  }

  return Response.json({
    processed: profilesWithData.length,
    periodAlerts,
    fertileAlerts,
    reminders,
    errors,
    skipped,
  })
})
