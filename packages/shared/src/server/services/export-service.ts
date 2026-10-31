import { AUDIT_ACTIONS } from './audit-actions'
import { prisma } from '../db'
import { createAuditLog } from './audit-service'
import { buildUsersWhere, type ListUsersParams } from './user-service'
import { buildFeedbackWhere, type FeedbackFilters } from './feedback-service'

type CsvCell = string | number | boolean | Date | null | undefined

const BOM = '﻿'

function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return ''
  let s = value instanceof Date ? value.toISOString() : String(value)
  // Formula-injection guard: only for text, never for real numbers.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Shared CSV writer: UTF-8 BOM (so Excel reads Bengali), RFC 4180 quoting,
 * CRLF row separators, and a leading `'` on cells that would run as formulas.
 */
export function toCsv(header: string[], rows: CsvCell[][]): string {
  const lines = [header, ...rows].map(r => r.map(csvCell).join(','))
  return BOM + lines.join('\r\n')
}

export type FeedbackExportFilters = FeedbackFilters

/** CSV of feedback entries (all fields), honouring the admin's current filters. Audit-logged. */
export async function generateFeedbackCsv(
  adminId: string,
  filters: FeedbackExportFilters = {},
): Promise<string> {
  const { category, rating, minRating, dateFrom, dateTo } = filters
  const search = filters.search?.trim()
  const where = buildFeedbackWhere(filters)

  const items = await prisma.feedback.findMany({
    where,
    include: { user: { select: { fullName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  })

  await createAuditLog(adminId, AUDIT_ACTIONS.EXPORT_FEEDBACK_CSV, 'Feedback', 'csv', {
    rows: items.length,
    filters: {
      category: category ?? null,
      rating: rating ?? null,
      minRating: minRating ?? null,
      search: search || null,
      dateFrom: dateFrom?.toISOString() ?? null,
      dateTo: dateTo?.toISOString() ?? null,
    },
  })

  return toCsv(
    ['ID', 'User ID', 'Profile ID', 'User', 'Email', 'Category', 'Message', 'Rating', 'Date'],
    items.map(f => [
      f.id,
      f.userId,
      f.profileId,
      f.user.fullName,
      f.user.email,
      f.category,
      f.message,
      f.rating,
      f.createdAt,
    ]),
  )
}

export type UsersExportFilters = Pick<ListUsersParams, 'search' | 'status'>

/** CSV of users matching the admin's current search/status filters (default: all non-deleted). Audit-logged. */
export async function generateUsersCsv(
  adminId: string,
  filters: UsersExportFilters = {},
): Promise<string> {
  const search = filters.search?.trim() || undefined
  const status = filters.status ?? 'all'
  const users = await prisma.user.findMany({
    where: buildUsersWhere({ search, status }),
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      authMethod: true,
      subscriptionStatus: true,
      role: true,
      profileCompleted: true,
      createdAt: true,
      lastLoginAt: true,
      _count: { select: { profiles: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  await createAuditLog(adminId, AUDIT_ACTIONS.EXPORT_USERS_CSV, 'User', 'csv', {
    rows: users.length,
    filters: { search: search ?? null, status },
  })

  return toCsv(
    ['ID', 'Name', 'Phone', 'Email', 'Auth Method', 'Subscription', 'Role', 'Profiles', 'Profile Complete', 'Created', 'Last Login'],
    users.map(u => [
      u.id,
      u.fullName,
      u.phone,
      u.email,
      u.authMethod,
      u.subscriptionStatus,
      u.role,
      u._count.profiles,
      u.profileCompleted,
      u.createdAt,
      u.lastLoginAt,
    ]),
  )
}
