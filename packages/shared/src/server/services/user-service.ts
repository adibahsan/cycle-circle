import { prisma } from '../db'

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
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      fullName: data.fullName,
      phone: data.phone,
      profileCompleted: true,
    },
  })

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
