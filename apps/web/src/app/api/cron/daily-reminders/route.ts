import { differenceInDays } from 'date-fns'
import { withCronAuth } from '@vesta/shared/server/middleware'
import { getProfilesForReminders, wasEmailSentToday, wasEmailSentTodayForUser } from '@vesta/shared/server/services'
import { prisma } from '@vesta/shared'
import {
  sendPeriodAlert,
  sendFertileAlert,
  sendLoggingReminder,
  sendProfileCompletionReminder,
} from '@vesta/shared/server/adapters/notifications'

/** How many days after signup to keep sending profile-completion reminders. */
const COMPLETION_REMINDER_MAX_AGE_DAYS = 14

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
  let completionReminders = 0
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

  // ── Profile-completion reminders ──────────────────────────────────────────────
  const campaignCutoff = new Date(today)
  campaignCutoff.setDate(campaignCutoff.getDate() - COMPLETION_REMINDER_MAX_AGE_DAYS)
  const oneDayAgo = new Date(today)
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)

  const incompleteUsers = await prisma.user.findMany({
    where: {
      profileCompleted: false,
      profileReminderOptOut: false,
      deletedAt: null,
      createdAt: {
        // created more than 24 h ago (give them a grace period on signup day)
        lte: oneDayAgo,
        // but still within the campaign window
        gte: campaignCutoff,
      },
    },
    select: {
      id: true,
      email: true,
      phone: true,
      fullName: true,
      language: true,
    },
  })

  for (const user of incompleteUsers) {
    try {
      if (await wasEmailSentTodayForUser('PROFILE_COMPLETION_REMINDER', user.id)) {
        skipped++
        continue
      }
      await sendProfileCompletionReminder({
        id: user.id,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        language: user.language,
        userId: user.id,
      })
      completionReminders++
    } catch (err) {
      console.error(
        `[cron/daily-reminders] Completion reminder error for user ${user.id}:`,
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
    completionReminders,
    errors,
    skipped,
  })
})
