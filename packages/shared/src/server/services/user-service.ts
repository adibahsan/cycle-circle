import { AuthMethod } from '@prisma/client'
import { prisma } from '../db'
import { applyBdappsSubscription } from './subscription-service'
import { ApiError } from '../api-error'

/**
 * Throw a typed 409 if a supplied phone/email already belongs to a DIFFERENT
 * user. Inputs must already be normalized (phone → validateMsisdn, email →
 * normalizeEmail). Best-effort pre-check; the inherent pre-check↔write race is
 * still caught by `mapContactP2002` at write time.
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

/**
 * Map a Prisma P2002 (unique constraint) on phone/email to a typed ApiError so a
 * racing duplicate surfaces the same code as the pre-check. Returns the original
 * error otherwise (to be re-thrown).
 */
function mapContactP2002(e: unknown): unknown {
  const err = e as { code?: string; meta?: { target?: string[] | string } }
  if (err.code === 'P2002') {
    const target = Array.isArray(err.meta?.target)
      ? err.meta.target.join(',')
      : String(err.meta?.target ?? '')
    if (target.includes('email')) {
      return new ApiError(409, 'Email already registered to another account', 'EMAIL_TAKEN')
    }
    if (target.includes('phone')) {
      return new ApiError(409, 'Phone already registered to another account', 'PHONE_TAKEN')
    }
  }
  return e
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}

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
  phone?: string
}

/**
 * Mark a user's profile as completed and update their name/phone.
 */
export async function completeUserProfile(userId: string, data: CompleteUserProfileData) {
  await assertContactAvailable(userId, { phone: data.phone })
  let updated
  try {
    updated = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: data.fullName,
        phone: data.phone,
        profileCompleted: true,
      },
    })
  } catch (e) {
    throw mapContactP2002(e)
  }

  return { id: updated.id, fullName: updated.fullName, profileCompleted: updated.profileCompleted }
}

/**
 * Suspend a user by setting suspendedAt + suspendedBy.
 */
export async function suspendUser(userId: string, adminId: string, reason?: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { suspendedAt: new Date(), suspendedBy: adminId },
  })

  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: 'USER_SUSPENDED',
      targetType: 'User',
      targetId: userId,
      metadata: reason ? { reason } : undefined,
    },
  })

  return { success: true }
}

/**
 * Clear suspension fields to reactivate a previously suspended user.
 */
export async function reactivateUser(userId: string, adminId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { suspendedAt: null, suspendedBy: null },
  })

  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: 'USER_REACTIVATED',
      targetType: 'User',
      targetId: userId,
    },
  })

  return { success: true }
}

/**
 * Soft-delete a user by setting deletedAt.
 */
export async function softDeleteUser(userId: string, adminId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  })

  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: 'USER_DELETED',
      targetType: 'User',
      targetId: userId,
    },
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

export async function updateUserContact(
  userId: string,
  data: { email?: string; phone?: string },
) {
  await assertContactAvailable(userId, data)
  try {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
      },
    })
  } catch (e) {
    throw mapContactP2002(e)
  }
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
export async function completeOnboardingTour(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { onboardingTourCompletedAt: new Date() },
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

export interface ChartDateRangeOpts {
  days?: number
  dateFrom?: Date
  dateTo?: Date
}

/**
 * Daily new-user signups over the given date range (default: last 30 days).
 * Gap-fills days with zero so the chart always has a continuous x-axis.
 */
export async function getUserSignupTrend(
  opts: ChartDateRangeOpts = {},
): Promise<{ date: string; count: number }[]> {
  const { dateTo = new Date(), dateFrom, days = 30 } = opts
  const resolvedFrom =
    dateFrom ?? new Date(new Date(dateTo).setDate(dateTo.getDate() - days + 1))

  // Truncate time component so grouping is day-level only
  const from = new Date(
    Date.UTC(resolvedFrom.getFullYear(), resolvedFrom.getMonth(), resolvedFrom.getDate()),
  )
  const to = new Date(
    Date.UTC(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate(), 23, 59, 59, 999),
  )

  const rows = await prisma.$queryRaw<{ date: string; count: bigint }[]>`
    SELECT
      TO_CHAR(DATE_TRUNC('day', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date,
      COUNT(*)::bigint AS count
    FROM "User"
    WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
    GROUP BY DATE_TRUNC('day', "createdAt" AT TIME ZONE 'UTC')
    ORDER BY DATE_TRUNC('day', "createdAt" AT TIME ZONE 'UTC') ASC
  `

  // Build a lookup from the raw results
  const lookup = new Map<string, number>()
  for (const row of rows) {
    lookup.set(row.date, Number(row.count))
  }

  // Gap-fill: walk day by day from `from` to `to`
  const result: { date: string; count: number }[] = []
  const cursor = new Date(from)
  while (cursor <= to) {
    const key = cursor.toISOString().slice(0, 10)
    result.push({ date: key, count: lookup.get(key) ?? 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return result
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

export async function getUserDetailForAdmin(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profiles: {
        include: {
          periodLogs: { orderBy: { startDate: 'desc' }, take: 5 },
          predictions: true,
          notificationPref: true,
          _count: { select: { periodLogs: true, symptomLogs: true } },
        },
      },
      subscriptions: {
        include: {
          caasTransactions: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      },
      feedback: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  })

  if (!user) throw new Error('User not found')
  return user
}
