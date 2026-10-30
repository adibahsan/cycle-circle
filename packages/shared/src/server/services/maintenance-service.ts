import { prisma } from '../db'
import { logger } from '../log'
import { RESTORE_WINDOW_DAYS } from '../../utils/restore-window'
import { MS_PER_DAY } from '../../utils/cycle-utils'
import { snapshotPredictionAccuracy } from './analytics-service'

/**
 * Permanently delete accounts whose restore window has closed (ADR 0006): the
 * user, profiles, logs, symptoms, feedback and subscriptions go (FK cascades),
 * leaving one translog line per user. Same rule as isWithinRestoreWindow: a
 * user deleted exactly RESTORE_WINDOW_DAYS ago is still restorable, so only
 * deletedAt strictly before the cutoff is purged. One failing user (e.g. an
 * admin who still owns articles) never blocks the rest.
 */
export async function purgeExpiredDeletedUsers(now: Date) {
  const cutoff = new Date(now.getTime() - RESTORE_WINDOW_DAYS * MS_PER_DAY)
  const users = await prisma.user.findMany({
    where: { deletedAt: { lt: cutoff } },
    select: { id: true, deletedAt: true },
  })

  const purgedUserIds: string[] = []
  let failed = 0
  for (const u of users) {
    try {
      await prisma.user.delete({ where: { id: u.id } })
      purgedUserIds.push(u.id)
      logger.translog('account.purge', { deletedAt: u.deletedAt?.toISOString() }, { userId: u.id })
    } catch (err) {
      failed++
      logger.cron('nightly-maintenance.purge-failed', { userId: u.id, error: String(err) }, { level: 'error' })
    }
  }
  return { purged: purgedUserIds.length, failed, purgedUserIds }
}

/** The nightly admin-maintenance job: MAE snapshot, then the 30-day purge. */
export async function runNightlyMaintenance(now: Date) {
  const tiers = await snapshotPredictionAccuracy(now)
  const purge = await purgeExpiredDeletedUsers(now)
  const summary = { snapshotTiers: tiers.length, purged: purge.purged, failed: purge.failed }
  logger.cron('nightly-maintenance.run', summary)
  return summary
}
