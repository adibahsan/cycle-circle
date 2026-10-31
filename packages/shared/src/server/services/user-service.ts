import { AUDIT_ACTIONS } from './audit-actions'
import { AuthMethod, type Prisma } from '@prisma/client'
import { prisma } from '../db'
import { applyBdappsSubscription, unsubscribeUserOnBdapps, type BdappsUnsubscribeResult } from './subscription-service'
import { ApiError } from '../api-error'
import { bumpSessionsValidAfter } from '../auth'
import { fillDaySeries, resolveDaySeriesRange, type DaySeriesOpts } from '../../utils/day-series'
import { RESTORE_WINDOW_DAYS, isWithinRestoreWindow } from '../../utils/restore-window'

/**
 * Throw a typed 409 if a supplied phone/email already belongs to a DIFFERENT
 * user. Inputs must already be normalized (phone → validateMsisdn, email →
 * normalizeEmail). Best-effort pre-check; the inherent pre-check↔write race is
 * still caught by the unique index at write time (P2002).
 */
export async function assertContactAvailable(
  userId: string,
  data: { email?: string; phone?: string },
): Promise<void> {
  if (data.phone) {
    const existing = await prisma.user.findUnique({
      where: { phone: data.phone },
      select: { id: true },
    })
    if (existing && existing.id !== userId) {
      throw new ApiError(409, 'Phone already registered to another account', 'PHONE_TAKEN')
    }
  }
  if (data.email) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    })
    if (existing && existing.id !== userId) {
      throw new ApiError(409, 'Email already registered to another account', 'EMAIL_TAKEN')
    }
  }
}

// ---------------------------------------------------------------------------
// listUsers
// ---------------------------------------------------------------------------

const SORTABLE_COLUMNS = new Set(['createdAt', 'lastLoginAt', 'fullName'])

export interface ListUsersParams {
  page?: number
  pageSize?: number
  search?: string
  status?: 'all' | 'active' | 'suspended' | 'deleted'
  role?: 'all' | 'USER' | 'ADMIN'
  sort?: string
  order?: 'asc' | 'desc'
}

export interface ListUsersResult {
  users: Array<{
    id: string
    phone: string | null
    email: string | null
    fullName: string | null
    authMethod: string
    subscriptionStatus: string
    role: string
    profileCompleted: boolean
    suspendedAt: Date | null
    deletedAt: Date | null
    lastLoginAt: Date | null
    createdAt: Date
    emailTrialExpiresAt: Date | null
    _count: { profiles: number }
  }>
  total: number
  page: number
  pageSize: number
  totalPages: number
  sort: string
  order: 'asc' | 'desc'
}

/** Single source of truth for the admin user list and CSV export filters. */
export function buildUsersWhere(
  filters: Pick<ListUsersParams, 'search' | 'status' | 'role'> = {},
): Prisma.UserWhereInput {
  const { search, status = 'all', role = 'all' } = filters
  const where: Prisma.UserWhereInput = {}
  if (status === 'active') {
    where.deletedAt = null
    where.suspendedAt = null
  } else if (status === 'suspended') {
    where.suspendedAt = { not: null }
    where.deletedAt = null
  } else if (status === 'deleted') {
    where.deletedAt = { not: null }
  } else {
    // 'all' — exclude soft-deleted by default
    where.deletedAt = null
  }

  if (role !== 'all') {
    where.role = role
  }

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
    ]
  }

  return where
}

/**
 * Paginated user list for admin use. Supports search, status/role filtering,
 * and sorting. The caller is responsible for auth — this function is pure
 * data access with no auth check of its own.
 */
export async function listUsers(params: ListUsersParams = {}): Promise<ListUsersResult> {
  const {
    page = 1,
    pageSize = 20,
    search,
    status = 'all',
    role = 'all',
    sort,
    order = 'desc',
  } = params

  const where = buildUsersWhere({ search, status, role })

  const safeSort = sort && SORTABLE_COLUMNS.has(sort) ? sort : 'createdAt'
  const safeOrder: 'asc' | 'desc' = order === 'asc' ? 'asc' : 'desc'

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        phone: true,
        email: true,
        fullName: true,
        authMethod: true,
        subscriptionStatus: true,
        role: true,
        profileCompleted: true,
        suspendedAt: true,
        deletedAt: true,
        lastLoginAt: true,
        createdAt: true,
        emailTrialExpiresAt: true,
        _count: { select: { profiles: true } },
      },
      orderBy: { [safeSort]: safeOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ])

  return {
    users,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    sort: safeSort,
    order: safeOrder,
  }
}

// ---------------------------------------------------------------------------
// Profile completion
// ---------------------------------------------------------------------------

export interface CompleteUserProfileData {
  fullName: string
}

/**
 * Mark a user's profile as completed and set their name.
 */
export async function completeUserProfile(userId: string, data: CompleteUserProfileData) {
  // Phone and email are never set here: they change only through OTP / email-code verification.
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { fullName: data.fullName, profileCompleted: true },
  })

  return { id: updated.id, fullName: updated.fullName, profileCompleted: updated.profileCompleted }
}

/** Admin accounts (including the caller) are managed outside the user list. */
async function assertManageableTarget(userId: string) {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, deletedAt: true } })
  if (!target) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND')
  if (target.role === 'ADMIN') {
    throw new ApiError(403, "Admin accounts can't be suspended or deleted.", 'ADMIN_TARGET')
  }
  return target
}

/**
 * Suspend a user (reason required), invalidate their sessions and unsubscribe their
 * number on BDApps (ADR 0006). A BDApps failure is returned, never thrown; the suspension applies.
 * Refuses unknown users (404) and admin targets (403).
 */
export async function suspendUser(userId: string, adminId: string, reason: string, now: Date) {
  const trimmed = reason?.trim()
  if (!trimmed) throw new ApiError(400, 'A suspension reason is required', 'REASON_REQUIRED')
  await assertManageableTarget(userId)

  await prisma.user.update({
    where: { id: userId },
    data: { suspendedAt: now, suspendedBy: adminId },
  })
  // Existing sessions stop working on their next request.
  await bumpSessionsValidAfter(userId, now)
  const bdapps = await unsubscribeUserOnBdapps(userId, adminId)

  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: AUDIT_ACTIONS.USER_SUSPENDED,
      targetType: 'User',
      targetId: userId,
      metadata: { reason: trimmed, bdapps: bdapps.status },
    },
  })

  return { success: true, bdapps }
}

/**
 * Clear suspension fields to reactivate a previously suspended user.
 * Lifts only our block; never re-subscribes on BDApps (ADR 0006).
 */
export async function reactivateUser(userId: string, adminId: string) {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { suspendedAt: true } })
  if (!target) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND')
  if (!target.suspendedAt) return { success: true as const, alreadyActive: true as const }

  await prisma.user.update({
    where: { id: userId },
    data: { suspendedAt: null, suspendedBy: null },
  })

  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: AUDIT_ACTIONS.USER_REACTIVATED,
      targetType: 'User',
      targetId: userId,
    },
  })

  return { success: true as const, alreadyActive: false as const }
}

/**
 * Soft-delete a user by setting deletedAt and unsubscribe their number on BDApps
 * (ADR 0006). A BDApps failure is returned, never thrown; the deletion applies.
 * Refuses unknown users (404) and admin targets (403). Already-deleted is a no-op so the
 * restore window is not reset.
 */
export async function softDeleteUser(
  userId: string,
  adminId: string,
  now: Date,
): Promise<{ success: true; bdapps: BdappsUnsubscribeResult | null; alreadyDeleted: boolean }> {
  const current = await assertManageableTarget(userId)
  if (current.deletedAt) return { success: true, bdapps: null, alreadyDeleted: true }

  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: now },
  })
  // Existing sessions stop working on their next request.
  await bumpSessionsValidAfter(userId, now)
  const bdapps = await unsubscribeUserOnBdapps(userId, adminId)

  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: AUDIT_ACTIONS.USER_DELETED,
      targetType: 'User',
      targetId: userId,
      metadata: { bdapps: bdapps.status },
    },
  })

  return { success: true, bdapps, alreadyDeleted: false }
}

/**
 * Restore a soft-deleted user within the restore window. Clears deletedAt only;
 * never re-subscribes on BDApps (ADR 0006). Refused after 30 days.
 */
export async function restoreUser(userId: string, adminId: string, now: Date) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { deletedAt: true } })
  if (!user) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND')
  if (!user.deletedAt) throw new ApiError(409, 'User is not deleted', 'NOT_DELETED')
  if (!isWithinRestoreWindow(user.deletedAt, now)) {
    throw new ApiError(409, `Accounts can only be restored within ${RESTORE_WINDOW_DAYS} days of deletion`, 'RESTORE_WINDOW_EXPIRED')
  }

  await prisma.user.update({ where: { id: userId }, data: { deletedAt: null } })
  await prisma.adminAuditLog.create({
    data: { adminId, action: AUDIT_ACTIONS.USER_RESTORED, targetType: 'User', targetId: userId },
  })

  return { success: true }
}

/**
 * Fetch a single user by ID. Returns null when not found.
 * Unlike getAuthUser in auth.ts, this does NOT throw on suspended/deleted users —
 * it is intended for admin reads that need to inspect those states.
 */
export async function getUserById(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } })
}

export async function updateUserName(userId: string, fullName: string) {
  return prisma.user.update({ where: { id: userId }, data: { fullName } })
}

/**
 * Save an OTP-verified phone on an email-trial account and upgrade it to PRO,
 * clearing the email trial. Used by the in-app "add your number to keep access"
 * flow. Assumes `phone` is already validated/normalized and OTP-verified, and
 * that uniqueness was pre-checked (a racing duplicate still surfaces as P2002).
 */
export async function keepAccountWithVerifiedPhone(
  userId: string,
  phone: string,
  registered: boolean,
  /** BDApps subscriberId from otp/verify (masked `tel:<id>`); defaults to the phone. */
  subscriberId: string = phone,
) {
  await prisma.user.update({
    where: { id: userId },
    data: registered ? { phone, emailTrialExpiresAt: null } : { phone },
  })
  const subscriptionStatus = await applyBdappsSubscription(userId, subscriberId, registered, 'phone-verify')
  return { subscriptionStatus }
}

export async function getUserByPhone(phone: string) {
  return prisma.user.findFirst({
    where: { phone },
    include: {
      subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })
}

// ---------------------------------------------------------------------------
// Profile completion status
// ---------------------------------------------------------------------------

export interface CompletionItem {
  key: string
  done: boolean
}

export interface ProfileCompletionStatus {
  percent: number
  complete: boolean
  items: CompletionItem[]
}

/** @deprecated Use CompletionItem instead */
export type ProfileCompletionItem = CompletionItem

/**
 * Compute profile-completion status for a user.
 * When profileId is omitted, uses the user's first (oldest) profile.
 * Keys map to `profileCompletion.item*` i18n strings on the client.
 *
 * Core items (drive percent + complete) — BOTH contact methods count:
 *   fullName, primary contact, secondary contact, goal, cycleHistory, firstLog
 * Primary/secondary contact depend on auth method: OTP signups have phone as
 * primary + email as secondary; email signups are the reverse.
 */
export async function getProfileCompletionStatus(
  userId: string,
  profileId?: string,
): Promise<ProfileCompletionStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      fullName: true,
      phone: true,
      email: true,
      authMethod: true,
      profiles: {
        where: profileId ? { id: profileId } : undefined,
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: {
          goal: true,
          cycleLength: true,
          periodLength: true,
          lastPeriodStart: true,
          _count: { select: { periodLogs: true } },
        },
      },
    },
  })

  const profile = user?.profiles[0] ?? null
  const periodLogCount = profile?._count.periodLogs ?? 0

  // Phone signups authenticate via OTP; their primary contact is the phone number.
  const isPhoneUser = user?.authMethod === AuthMethod.OTP

  const phoneItem: CompletionItem = { key: 'phone', done: Boolean(user?.phone) }
  const emailItem: CompletionItem = { key: 'email', done: Boolean(user?.email) }

  const coreItems: CompletionItem[] = [
    { key: 'fullName', done: Boolean(user?.fullName) },
    // Both contact methods count toward completion (primary first, then secondary).
    ...(isPhoneUser ? [phoneItem, emailItem] : [emailItem, phoneItem]),
    { key: 'goal', done: Boolean(profile?.goal) },
    {
      key: 'cycleHistory',
      done: Boolean(
        profile?.cycleLength && profile?.periodLength && profile?.lastPeriodStart,
      ),
    },
    { key: 'firstLog', done: periodLogCount >= 1 },
  ]

  const doneCoreCount = coreItems.filter((i) => i.done).length
  const percent = Math.round((doneCoreCount / coreItems.length) * 100)

  return {
    percent,
    complete: coreItems.every((i) => i.done),
    items: coreItems,
  }
}

/**
 * Mark the onboarding tour as completed for a user by recording the timestamp.
 */
export async function completeOnboardingTour(userId: string, now: Date): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { onboardingTourCompletedAt: now },
  })
}

/**
 * Set the profile-completion reminder opt-out flag for a user.
 * Returns the updated flag value.
 */
export async function setProfileReminderOptOut(
  userId: string,
  optOut: boolean,
): Promise<boolean> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { profileReminderOptOut: optOut },
    select: { profileReminderOptOut: true },
  })
  return updated.profileReminderOptOut
}

// ---------------------------------------------------------------------------
// Chart-data aggregations for admin Users section
// ---------------------------------------------------------------------------

export type ChartDateRangeOpts = DaySeriesOpts

/**
 * Daily new-user signups over the given date range (default: last 30 days).
 * Gap-fills days with zero so the chart always has a continuous x-axis.
 */
export async function getUserSignupTrend(
  opts: ChartDateRangeOpts,
): Promise<{ date: string; count: number }[]> {
  const { from, to, fromDay, toDay } = resolveDaySeriesRange(opts)

  // Bucket by Bangladesh day (UTC+6), not UTC day. "createdAt" is a UTC timestamp without zone, so tag it UTC first.
  const rows = await prisma.$queryRaw<{ date: string; count: bigint }[]>`
    SELECT
      TO_CHAR(DATE_TRUNC('day', ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka'), 'YYYY-MM-DD') AS date,
      COUNT(*)::bigint AS count
    FROM "User"
    WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
    GROUP BY DATE_TRUNC('day', ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka')
    ORDER BY DATE_TRUNC('day', ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka') ASC
  `

  const lookup = new Map<string, number>()
  for (const row of rows) {
    lookup.set(row.date, Number(row.count))
  }

  return fillDaySeries(fromDay, toDay, lookup)
}

/**
 * Count of users grouped by authMethod (OTP, EMAIL, etc.).
 */
export async function getAuthMethodDistribution(): Promise<
  { method: string; count: number }[]
> {
  const rows = await prisma.user.groupBy({
    by: ['authMethod'],
    _count: { _all: true },
    where: { deletedAt: null },
  })

  return rows.map((r) => ({ method: r.authMethod as string, count: r._count._all }))
}

/**
 * Count of users grouped by subscriptionStatus (FREE, PRO, LAPSED).
 * Excludes soft-deleted users.
 */
export async function getSubscriptionStatusDistribution(): Promise<
  { status: string; count: number }[]
> {
  const rows = await prisma.user.groupBy({
    by: ['subscriptionStatus'],
    _count: { _all: true },
    where: { deletedAt: null },
  })

  return rows.map((r) => ({
    status: r.subscriptionStatus as string,
    count: r._count._all,
  }))
}

/**
 * Count of users grouped by preferred language (EN, BN, etc.).
 * Excludes soft-deleted users.
 */
export async function getLanguageDistribution(): Promise<
  { language: string; count: number }[]
> {
  const rows = await prisma.user.groupBy({
    by: ['language'],
    _count: { _all: true },
    where: { deletedAt: null },
  })

  return rows.map((r) => ({ language: r.language as string, count: r._count._all }))
}

/**
 * Breakdown of users by account status:
 *   - active: not suspended and not deleted
 *   - suspended: suspendedAt IS NOT NULL and deletedAt IS NULL
 *   - deleted: deletedAt IS NOT NULL
 */
export async function getUserStatusBreakdown(): Promise<
  { status: 'active' | 'suspended' | 'deleted'; count: number }[]
> {
  const [active, suspended, deleted] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null, suspendedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, suspendedAt: { not: null } } }),
    prisma.user.count({ where: { deletedAt: { not: null } } }),
  ])

  return [
    { status: 'active', count: active },
    { status: 'suspended', count: suspended },
    { status: 'deleted', count: deleted },
  ]
}

/** Single source of truth for what the admin user-detail page may receive. No secret columns. */
const adminUserDetailSelect = {
  id: true,
  phone: true,
  email: true,
  fullName: true,
  authMethod: true,
  subscriptionStatus: true,
  role: true,
  profileCompleted: true,
  suspendedAt: true,
  deletedAt: true,
  lastLoginAt: true,
  createdAt: true,
  emailTrialExpiresAt: true,
  profiles: {
    select: {
      id: true,
      name: true,
      relation: true,
      cycleLength: true,
      periodLength: true,
      periodLogs: {
        select: { id: true, startDate: true, endDate: true },
        orderBy: { startDate: 'desc' },
        take: 5,
      },
      notificationPref: {
        select: { id: true, periodAlert: true, fertileWindow: true, loggingReminder: true },
      },
      _count: { select: { periodLogs: true, symptomLogs: true } },
    },
  },
  subscriptions: {
    select: {
      id: true,
      status: true,
      adminOverride: true,
      adminOverrideAt: true,
      createdAt: true,
      caasTransactions: {
        select: { id: true, amount: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  },
  feedback: {
    select: { id: true, category: true, message: true, rating: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  },
} satisfies Prisma.UserSelect

export type AdminUserDetail = Prisma.UserGetPayload<{ select: typeof adminUserDetailSelect }>

// Compile-time guard (#185): adding a secret column to the select above fails typecheck.
type SecretUserColumn = 'passwordHash' | 'sessionsValidAfter' | 'suspendedBy'
const _noSecretsInAdminUserDetail: Extract<keyof AdminUserDetail, SecretUserColumn> extends never ? true : never = true
void _noSecretsInAdminUserDetail

/** Returns null when the user does not exist. */
export async function getUserDetailForAdmin(userId: string): Promise<AdminUserDetail | null> {
  return prisma.user.findUnique({ where: { id: userId }, select: adminUserDetailSelect })
}
