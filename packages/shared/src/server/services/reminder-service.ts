import { prisma } from '../db'
import { logger } from '../log'
import {
  addDaysToDay,
  bangladeshToday,
  daysBetween,
  parseDhakaDay,
  storedDateToDay,
} from '../../utils/dhaka-date'
import { getProfilesForReminders } from './tracking-service'
import { reminderSmsAddress } from './subscription-service'
import { wasEmailSentToday, wasEmailSentTodayForUser } from './email-service'
import {
  sendPeriodAlert,
  sendFertileAlert,
  sendLoggingReminder,
  sendProfileCompletionReminder,
} from '../adapters/notifications'

/** How many days after signup to keep sending profile-completion reminders. */
const COMPLETION_REMINDER_MAX_AGE_DAYS = 14

export interface RunDailyRemindersOptions {
  /** The moment the run happens at; the cron route reads the clock and passes it in. */
  now: Date
  userId?: string
  force?: boolean
}

export interface DailyRemindersResult {
  processed: number
  periodAlerts: number
  fertileAlerts: number
  reminders: number
  completionReminders: number
  errors: number
  skipped: number
}

/**
 * Runs the daily-reminder logic for all users (unscoped) or a single user
 * (when `userId` is provided). When `force` is true, the dedup checks that
 * prevent sending the same email twice in one day are skipped, which lets an
 * admin re-trigger a specific user's reminders on demand.
 */
export async function runDailyReminders(
  opts: RunDailyRemindersOptions,
): Promise<DailyRemindersResult> {
  const { userId, force = false, now } = opts

  // Days are counted on the Bangladesh calendar; stored date-only values are UTC midnight of their day.
  const today = bangladeshToday(now)

  let periodAlerts = 0
  let fertileAlerts = 0
  let reminders = 0
  let completionReminders = 0
  let errors = 0
  let skipped = 0

  // One lookup per User per run, however many profiles and reminders they have.
  const smsAddresses = new Map<string, Promise<string | null>>()
  const smsAddressFor = (id: string) => {
    let address = smsAddresses.get(id)
    if (!address) smsAddresses.set(id, (address = reminderSmsAddress(id)))
    return address
  }

  const profilesWithData = await getProfilesForReminders(userId)

  for (const profile of profilesWithData) {
    const prefs = profile.notificationPref
    if (!prefs) continue

    const { user } = profile
    const { language } = user

    const prediction = profile.predictions[0] ?? null

    try {
      const smsTo = await smsAddressFor(user.id)

      if (prefs.periodAlert && prediction) {
        const daysUntil = daysBetween(today, storedDateToDay(prediction.nextPeriodStart))
        if (daysUntil >= 0 && daysUntil <= 2) {
          if (!force && (await wasEmailSentToday('PERIOD_ALERT', profile.id, now))) {
            skipped++
          } else {
            await sendPeriodAlert({
              email: user.email,
              userName: user.fullName ?? 'User',
              profileName: profile.name,
              language,
              predictedDate: prediction.nextPeriodStart
                .toISOString()
                .split('T')[0]!,
              daysUntil,
              smsTo,
              userId: user.id,
              profileId: profile.id,
            })
            periodAlerts++
          }
        }
      }

      if (prefs.fertileWindow && prediction) {
        const fertileStartDiff = daysBetween(today, storedDateToDay(prediction.fertileStart))
        if (fertileStartDiff === 0) {
          if (!force && (await wasEmailSentToday('FERTILE_ALERT', profile.id, now))) {
            skipped++
          } else {
            await sendFertileAlert({
              email: user.email,
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
              smsTo,
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
          ? daysBetween(storedDateToDay(lastLog.startDate), today)
          : 999
        if (daysSince >= 3) {
          if (!force && (await wasEmailSentToday('LOGGING_REMINDER', profile.id, now))) {
            skipped++
          } else {
            await sendLoggingReminder({
              email: user.email,
              userName: user.fullName ?? 'User',
              profileName: profile.name,
              language,
              daysSinceLastLog: daysSince,
              smsTo,
              userId: user.id,
              profileId: profile.id,
            })
            reminders++
          }
        }
      }
    } catch (err) {
      logger.cron('reminders.notification.failed', { profileId: profile.id, error: String(err) }, { level: 'error' })
      errors++
    }
  }

  // ── Profile-completion reminders ──────────────────────────────────────────────
  // Cutoffs are the start of a Bangladesh day, so the 14-day window rolls over at Bangladesh midnight.
  const campaignCutoff = parseDhakaDay(addDaysToDay(today, -COMPLETION_REMINDER_MAX_AGE_DAYS))!
  const oneDayAgo = parseDhakaDay(addDaysToDay(today, -1))!

  const incompleteUsers = await prisma.user.findMany({
    where: {
      ...(userId ? { id: userId } : {}),
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
      fullName: true,
      language: true,
    },
  })

  for (const user of incompleteUsers) {
    try {
      if (
        !force &&
        (await wasEmailSentTodayForUser('PROFILE_COMPLETION_REMINDER', user.id, now))
      ) {
        skipped++
        continue
      }
      await sendProfileCompletionReminder({
        id: user.id,
        email: user.email,
        smsTo: await smsAddressFor(user.id),
        fullName: user.fullName,
        language: user.language,
        userId: user.id,
      })
      completionReminders++
    } catch (err) {
      logger.cron('reminders.completion.failed', { userId: user.id, error: String(err) }, { level: 'error' })
      errors++
    }
  }

  return {
    processed: profilesWithData.length,
    periodAlerts,
    fertileAlerts,
    reminders,
    completionReminders,
    errors,
    skipped,
  }
}
