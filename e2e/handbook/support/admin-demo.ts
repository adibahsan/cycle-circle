/**
 * Admin-capture support for the handbook (`handbook-admin` project: desktop 1366x900, baseURL = the
 * slot's Admin app). Reusable by every Admin chapter ticket.
 *
 *  - `ADMIN_STATE`            storage state of the seeded Admin (made by global-setup). Use it as
 *                             `test.use({ storageState: ADMIN_STATE })`. READ-ONLY: never click Sign out
 *                             with it (logout blacklists the session for every other test); use
 *                             `createLoggedInAdmin` from e2e/support/admin.ts for that.
 *  - `seedDemoMembers(db)`    ~24 fake Users (Bangladeshi demo names, +8801711000xxx numbers, example.test
 *                             emails) spread over 30 days, plus Pro snapshots, daily activity and churn
 *                             events for the Overview, and one healthy daily-subscription-check run for the Subscriptions strip. Idempotent and safe to call from parallel files.
 *  - `freshDemoMember(db, k)` ONE disposable Pro User you may suspend / delete / revoke in a shot; it is
 *                             created fresh (new id) each time it is called.
 */
import type { PrismaClient } from '@prisma/client'
import { statePath } from '../../support/personas.ts'

export const ADMIN_STATE = statePath('admin')

const DAY = 24 * 60 * 60 * 1000

type Kind = 'pro' | 'override' | 'trial' | 'trial-expired' | 'lapsed' | 'suspended' | 'deleted' | 'free'

const ROSTER: Array<[name: string, kind: Kind]> = [
  ['Nusrat Jahan', 'pro'], ['Tasnim Sultana', 'pro'], ['Farzana Akter', 'pro'], ['Shirin Nahar', 'trial'],
  ['Rokeya Begum', 'pro'], ['Lamia Rahman', 'override'], ['Jannat Ara', 'pro'], ['Mim Chowdhury', 'trial-expired'],
  ['Sabina Yasmin', 'pro'], ['Kaniz Fatema', 'lapsed'], ['Popy Khatun', 'pro'], ['Ruma Das', 'pro'],
  ['Halima Khatun', 'suspended'], ['Moushumi Haque', 'pro'], ['Salma Parvin', 'pro'], ['Tania Ferdous', 'trial'],
  ['Bithi Sarker', 'pro'], ['Nargis Aktar', 'deleted'], ['Dilruba Islam', 'pro'], ['Shapla Roy', 'free'],
  ['Mahfuza Khan', 'pro'], ['Reshma Biswas', 'pro'], ['Anika Tabassum', 'pro'], ['Sumaiya Hoque', 'pro'],
]

// Seeding uses skipDuplicates, so re-running does not refresh roster fields changed since the first run; reset the slot DB to pick them up.
export const DEMO_FIRST = { name: 'Nusrat Jahan', id: 'hbdemo-01' }

const idOf = (i: number) => `hbdemo-${String(i + 1).padStart(2, '0')}`
const phoneOf = (i: number) => `+8801711000${100 + i}`
const emailOf = (name: string) => `${name.toLowerCase().replace(/\s+/g, '.')}@example.test`

/** Calendar day (`YYYY-MM-DD`, UTC date part) `n` days before `now`, as the @db.Date value. */
const dayDate = (now: Date, n: number) => new Date(`${new Date(now.getTime() - n * DAY).toISOString().slice(0, 10)}T00:00:00.000Z`)

export async function seedDemoMembers(db: PrismaClient): Promise<void> {
  const now = new Date()
  const users = ROSTER.map(([name, kind], i) => {
    const emailUser = kind === 'trial' || kind === 'trial-expired'
    const created = new Date(now.getTime() - (i + 1) * DAY * 1.2 - i * 3_600_000)
    const status = kind === 'pro' || kind === 'override' ? 'PRO' : kind === 'lapsed' ? 'LAPSED' : kind === 'suspended' || kind === 'deleted' ? 'PRO' : 'FREE'
    return {
      id: idOf(i), fullName: name, authMethod: emailUser ? ('EMAIL' as const) : ('OTP' as const),
      phone: emailUser ? null : phoneOf(i), email: emailUser ? emailOf(name) : null,
      subscriptionStatus: status as 'PRO' | 'FREE' | 'LAPSED', profileCompleted: true,
      language: i % 3 === 0 ? ('BN' as const) : ('EN' as const),
      emailTrialExpiresAt: kind === 'trial' ? new Date(now.getTime() + 9 * 3_600_000) : kind === 'trial-expired' ? new Date(now.getTime() - 5 * 3_600_000) : null,
      suspendedAt: kind === 'suspended' ? new Date(now.getTime() - 2 * DAY) : null,
      deletedAt: kind === 'deleted' ? new Date(now.getTime() - 4 * DAY) : null,
      lastLoginAt: new Date(Math.min(now.getTime() - 3_600_000, created.getTime() + (i % 5) * DAY)),
      createdAt: created,
    }
  })
  await db.user.createMany({ data: users, skipDuplicates: true })

  const subs = ROSTER.flatMap(([, kind], i) =>
    kind === 'trial' || kind === 'trial-expired' || kind === 'free' ? [] : [{
      id: `hbdemo-sub-${idOf(i)}`, userId: idOf(i),
      status: (kind === 'lapsed' ? 'LAPSED' : 'PRO') as 'LAPSED' | 'PRO',
      bdappsSubscriberId: `tel:hbdemo${100 + i}`,
      adminOverride: kind === 'override', adminOverrideAt: kind === 'override' ? new Date(now.getTime() - DAY) : null,
      lastConfirmedAt: new Date(now.getTime() - 5 * 3_600_000), lastReportedStatus: kind === 'lapsed' ? 'UNREGISTERED' : 'REGISTERED',
      createdAt: new Date(now.getTime() - (i + 1) * DAY * 1.2),
    }],
  )
  await db.subscription.createMany({ data: subs, skipDuplicates: true })

  // Profiles: the first member has two (for the detail page), the others one each.
  const profiles = ROSTER.flatMap(([name, kind], i) =>
    kind === 'trial' || kind === 'trial-expired' ? [] : [{
      id: `hbdemo-prof-${idOf(i)}`, userId: idOf(i), name: name.split(' ')[0]!, relation: 'SELF' as const,
      cycleLength: 26 + (i % 5), periodLength: 4 + (i % 3), lastPeriodStart: new Date(now.getTime() - (6 + i) * DAY),
    }],
  )
  profiles.push({ id: 'hbdemo-prof-hbdemo-01b', userId: idOf(0), name: 'Maliha', relation: 'DAUGHTER' as never, cycleLength: 30, periodLength: 5, lastPeriodStart: new Date(now.getTime() - 12 * DAY) })
  await db.profile.createMany({ data: profiles, skipDuplicates: true })
  await db.notificationPreference.createMany({
    data: profiles.map((p, i) => ({ id: `hbdemo-np-${p.id}`, profileId: p.id, periodAlert: true, fertileWindow: i % 4 !== 1, loggingReminder: i % 3 !== 1 })),
    skipDuplicates: true,
  })
  await db.periodLog.createMany({
    data: [0, 1, 2].map((k) => ({
      id: `hbdemo-log-${k}`, profileId: 'hbdemo-prof-hbdemo-01', startDate: new Date(now.getTime() - (34 + k * 28) * DAY),
      endDate: new Date(now.getTime() - (29 + k * 28) * DAY), flowIntensity: 'MEDIUM' as const,
    })),
    skipDuplicates: true,
  })
  await db.feedback.createMany({
    data: [{ id: 'hbdemo-fb-1', userId: idOf(0), category: 'FEATURE' as const, message: 'Please add a weekly summary of my symptoms.', rating: 4, createdAt: new Date(now.getTime() - 3 * DAY) }],
    skipDuplicates: true,
  })

  // Overview history: nightly Pro counts, daily activity of the live members, a few churn events.
  await db.proSnapshot.createMany({
    data: Array.from({ length: 60 }, (_, n) => ({ day: dayDate(now, n + 1), proCount: Math.max(4, 22 - Math.floor(n / 4) + (n % 3)) })),
    skipDuplicates: true,
  })
  const live = ROSTER.flatMap(([, kind], i) => (kind === 'suspended' || kind === 'deleted' ? [] : [i]))
  await db.userActivity.createMany({
    data: Array.from({ length: 14 }, (_, n) => live.filter((i) => (i + n) % 3 !== 0 || n < 2).map((i) => ({ userId: idOf(i), day: dayDate(now, n) }))).flat(),
    skipDuplicates: true,
  })
  await db.subscriptionCheckRun.createMany({
    data: [{ id: 'hbdemo-run-1', startedAt: new Date(now.getTime() - 3 * 3_600_000), finishedAt: new Date(now.getTime() - 3 * 3_600_000 + 40_000), trigger: 'CRON' as const, status: 'OK' as const, checkedCount: 24, movedCount: 1, errorCount: 0 }],
    skipDuplicates: true,
  })
  const reasons = ['DAILY_CHECK', 'BDAPPS_UNSUBSCRIBE', 'ADMIN_REVOKE', 'ACCOUNT_DELETED', 'BDAPPS_UNSUBSCRIBE', 'DAILY_CHECK'] as const
  await db.churnEvent.createMany({
    data: reasons.map((reason, k) => ({ id: `hbdemo-churn-${k}`, userId: null, reason, occurredAt: new Date(now.getTime() - (2 + k * 3) * DAY) })),
    skipDuplicates: true,
  })
}

/** One disposable Pro User with a profile and notification preferences, created fresh on every call. */
export async function freshDemoMember(db: PrismaClient, key: string, name: string, phoneTail: number): Promise<{ id: string; name: string }> {
  // A new id per call: the Translog (plan history) lives in log files that outlive the DB reset, keyed by user id.
  const id = `hbact-${key}-${Date.now().toString(36)}`
  await db.user.deleteMany({ where: { phone: `+8801711009${String(phoneTail).padStart(3, '0')}` } })
  const now = new Date()
  await db.user.create({
    data: {
      id, fullName: name, phone: `+8801711009${String(phoneTail).padStart(3, '0')}`, authMethod: 'OTP', subscriptionStatus: 'PRO',
      profileCompleted: true, createdAt: new Date(now.getTime() - 20 * DAY), lastLoginAt: new Date(now.getTime() - 2 * 3_600_000),
      subscriptions: { create: { id: `${id}-sub`, status: 'PRO', bdappsSubscriberId: `tel:hbact${phoneTail}`, lastConfirmedAt: new Date(now.getTime() - 4 * 3_600_000), lastReportedStatus: 'REGISTERED' } },
      profiles: { create: { id: `${id}-prof`, name: name.split(' ')[0]!, relation: 'SELF', cycleLength: 28, periodLength: 5, lastPeriodStart: new Date(now.getTime() - 9 * DAY), notificationPref: { create: { id: `${id}-np` } } } },
    },
  })
  return { id, name }
}
