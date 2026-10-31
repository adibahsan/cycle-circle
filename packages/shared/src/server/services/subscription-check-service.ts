import { prisma } from '../db'
import { logger } from '../log'
import { getSubscriptionStatus, isPhoneSubscriberId } from '../adapters/bdapps'
import { isCronEnabled } from './cron-settings-service'
import {
  applyBdappsSubscription,
  listBdappsSubscribers,
  listRevokedSubscribers,
} from './subscription-service'

export type SubscriptionCheckTriggerKind = 'CRON' | 'MANUAL'
export type SubscriptionCheckRunStatus = 'OK' | 'FAILED' | 'SKIPPED'

export interface RunDailySubscriptionCheckOptions {
  trigger: SubscriptionCheckTriggerKind
  /** The moment the run starts (ADR 0009): stored as the run's start and "last confirmed" time. */
  now: Date
  /** Reads the clock for the run's finish time; the edge passes `() => new Date()` (ADR 0009). */
  clock: () => Date
  /** Run even when the job is switched off (the admin's manual "Run now"). */
  overrideDisabled?: boolean
  /** BDApps status lookup; defaults to the live adapter. Tests pass a stub. */
  getStatus?: (subscriberId: string) => Promise<string>
}

export interface SubscriptionCheckResult {
  runId: string
  status: SubscriptionCheckRunStatus
  checked: number
  /** Subscribers moved to Free. */
  moved: number
  /** Ambiguous legacy phone ids that were left alone. */
  skipped: number
  errors: number
  /** Revoked users whose new BDApps subscription ended the admin override. */
  reinstated: number
  /** Users whose plan changed, so the caller can drop their caches. */
  movedUserIds: string[]
  reinstatedUserIds: string[]
}

/** A raw phone id never reaches storage; masked ids are already opaque. */
function maskSubscriberId(subscriberId: string): string {
  return isPhoneSubscriberId(subscriberId) ? 'phone-id (not stored)' : subscriberId
}

function isForeignKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2003'
}

/** Strip any raw Bangladesh phone number out of free text before it is stored. */
function scrubPhones(text: string): string {
  return text.replace(/\+?8801\d{9}/g, '<phone>')
}

/**
 * Store when BDApps last answered for a subscriber. A legacy Pro user has no Subscription row
 * (only a phone id), so one is created that mirrors what they already are: Pro, with that same id,
 * no amount and no override. Their plan and the id the check asks about do not change.
 */
async function recordConfirmed(userId: string, subscriberId: string, status: string, at: Date) {
  const row = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  if (row) {
    await prisma.subscription.update({
      where: { id: row.id },
      data: { lastConfirmedAt: at, lastReportedStatus: status },
    })
    return
  }
  try {
    await prisma.subscription.create({
      data: { userId, status: 'PRO', bdappsSubscriberId: subscriberId, lastConfirmedAt: at, lastReportedStatus: status },
    })
  } catch (err) {
    // The user was deleted since the list was read: nothing left to record.
    if (!isForeignKeyError(err)) throw err
  }
}

/**
 * The daily subscription check (GLOSSARY): asks BDApps about each subscriber, moves anyone no
 * longer subscribed back to Free, and persists a run record for cron and manual triggers alike.
 * Never downgrades on errors.
 */
export async function runDailySubscriptionCheck(
  opts: RunDailySubscriptionCheckOptions,
): Promise<SubscriptionCheckResult> {
  const { trigger, now, clock } = opts
  const getStatus = opts.getStatus ?? getSubscriptionStatus
  const empty = { checked: 0, moved: 0, skipped: 0, errors: 0, reinstated: 0, movedUserIds: [], reinstatedUserIds: [] }

  if (!opts.overrideDisabled && !(await isCronEnabled('caas-check'))) {
    const run = await prisma.subscriptionCheckRun.create({
      data: { startedAt: now, finishedAt: now, trigger, status: 'SKIPPED' },
    })
    return { runId: run.id, status: 'SKIPPED', ...empty }
  }

  const run = await prisma.subscriptionCheckRun.create({
    data: { startedAt: now, trigger, status: 'OK' },
  })

  let checked = 0
  let moved = 0
  let skipped = 0
  let errors = 0
  let reinstated = 0
  const movedUserIds: string[] = []
  const reinstatedUserIds: string[] = []
  const outcomes: {
    runId: string
    userId: string
    maskedSubscriberId: string
    outcome: 'MOVED_TO_FREE' | 'ERROR'
    bdappsStatus?: string
    error?: string
  }[] = []

  const recordError = (userId: string, subscriberId: string, err: unknown) => {
    errors++
    outcomes.push({
      runId: run.id,
      userId,
      maskedSubscriberId: maskSubscriberId(subscriberId),
      outcome: 'ERROR',
      error: scrubPhones(err instanceof Error ? err.message : String(err)),
    })
    logger.cron('caas-check.failed', { userId, subscriberId, error: String(err) }, { level: 'error' })
  }

  try {
    for (const sub of await listBdappsSubscribers()) {
      const { subscriberId } = sub
      checked++
      try {
        const status = await getStatus(subscriberId)
        await recordConfirmed(sub.userId, subscriberId, status, now)
        if (status === 'UNREGISTERED' && isPhoneSubscriberId(subscriberId)) {
          // Masked-number apps reject raw phone ids with E1951, which reads as
          // UNREGISTERED: ambiguous, so never downgrade a legacy phone-id row.
          skipped++
        } else if (status === 'UNREGISTERED') {
          await applyBdappsSubscription(sub.userId, subscriberId, false, 'nightly-check', now)
          moved++
          movedUserIds.push(sub.userId)
          outcomes.push({
            runId: run.id,
            userId: sub.userId,
            maskedSubscriberId: maskSubscriberId(subscriberId),
            outcome: 'MOVED_TO_FREE',
            bdappsStatus: status,
          })
        }
      } catch (err) {
        recordError(sub.userId, subscriberId, err)
      }
    }

    // Revoked users: a new BDApps subscription ends the admin override (ADR 0006).
    for (const sub of await listRevokedSubscribers()) {
      checked++
      try {
        const status = await getStatus(sub.subscriberId)
        await recordConfirmed(sub.userId, sub.subscriberId, status, now)
        if (status === 'REGISTERED') {
          await applyBdappsSubscription(sub.userId, sub.subscriberId, true, 'nightly-check')
          reinstated++
          reinstatedUserIds.push(sub.userId)
        }
      } catch (err) {
        recordError(sub.userId, sub.subscriberId, err)
      }
    }

    // A user can be deleted while the run is going: keep their outcome (it answers "why did I lose
    // Pro?") with no user link, instead of failing on the foreign key.
    if (outcomes.length > 0) {
      const present = new Set(
        (
          await prisma.user.findMany({
            where: { id: { in: outcomes.map((o) => o.userId) } },
            select: { id: true },
          })
        ).map((u) => u.id),
      )
      const rows = outcomes.map((o) => ({ ...o, userId: present.has(o.userId) ? o.userId : null }))
      try {
        await prisma.subscriptionCheckOutcome.createMany({ data: rows })
      } catch (err) {
        if (!isForeignKeyError(err)) throw err
        // A user was deleted between the check above and this write: store rows one by one and
        // drop the link of whichever user vanished.
        for (const row of rows) {
          try {
            await prisma.subscriptionCheckOutcome.create({ data: row })
          } catch (rowErr) {
            if (!isForeignKeyError(rowErr)) throw rowErr
            await prisma.subscriptionCheckOutcome.create({ data: { ...row, userId: null } })
          }
        }
      }
    }
  } catch (err) {
    await prisma.subscriptionCheckRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        finishedAt: clock(),
        checkedCount: checked,
        movedCount: moved,
        errorCount: errors,
        error: scrubPhones(err instanceof Error ? err.message : String(err)),
      },
    })
    throw err
  }

  await prisma.subscriptionCheckRun.update({
    where: { id: run.id },
    data: { status: 'OK', finishedAt: clock(), checkedCount: checked, movedCount: moved, errorCount: errors },
  })

  return { runId: run.id, status: 'OK', checked, moved, skipped, errors, reinstated, movedUserIds, reinstatedUserIds }
}

/** The newest runs of the daily subscription check, newest first. */
export async function listSubscriptionCheckRuns(limit = 30) {
  return prisma.subscriptionCheckRun.findMany({ orderBy: { startedAt: 'desc' }, take: limit })
}

/** One run with the subscribers it moved to Free or errored on. */
export async function getSubscriptionCheckRun(id: string) {
  return prisma.subscriptionCheckRun.findUnique({
    where: { id },
    include: {
      outcomes: {
        orderBy: [{ outcome: 'asc' }, { createdAt: 'asc' }],
        include: { user: { select: { fullName: true, email: true } } },
      },
    },
  })
}
