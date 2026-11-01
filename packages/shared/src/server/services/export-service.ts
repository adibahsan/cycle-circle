import { toCsv } from '../../utils/csv'
import { AUDIT_ACTIONS } from './audit-actions'
import { prisma } from '../db'
import { createAuditLog } from './audit-service'
import { listEmailLogs } from './email-service'
import { listCampaigns } from './campaign-service'
import { listSubscriptions } from './subscription-service'
import type { DayWindow } from '../../utils/date-range'
import { buildUsersWhere, type ListUsersParams } from './user-service'
import { buildFeedbackWhere, type FeedbackFilters } from './feedback-service'

import type { CsvCell } from '../../utils/csv'
export { toCsv }

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

export type ExportableTable = 'subscriptions' | 'sms-campaigns' | 'emails'

export interface TableExportFilters {
  /** The page's shared range; rows outside it are left out. */
  range: Pick<DayWindow, 'from' | 'to'>
  status?: string
  search?: string
  q?: string
  type?: string
  deliveryStatus?: string
}

/** Most rows a table export writes; the page lists are paginated, the export is not. */
export const TABLE_EXPORT_ROW_CAP = 10_000

/**
 * CSV of a dashboard table with the page's own filters, for the selected range. The campaign list
 * is the exception: it is a planning list (upcoming days are its point), so the range does not cut it. Rows are the
 * whole filtered set, not the current page. Audit-logged because rows carry contact details.
 */
export async function generateTableCsv(
  adminId: string,
  table: ExportableTable,
  filters: TableExportFilters,
): Promise<string> {
  const { from: dateFrom, to: dateTo } = filters.range
  const page = { page: 1, pageSize: TABLE_EXPORT_ROW_CAP, dateFrom, dateTo }
  let header: string[]
  let rows: CsvCell[][]
  let targetType: string

  if (table === 'subscriptions') {
    const { subscriptions } = await listSubscriptions({ ...page, status: filters.status })
    targetType = 'Subscription'
    header = ['ID', 'User', 'Phone', 'Email', 'Status', 'Amount', 'Payment', 'Admin override', 'Last confirmed', 'Created', 'Updated']
    rows = subscriptions.map((s) => [
      s.id, s.user.fullName, s.user.phone, s.user.email, s.status, s.amount, s.paymentInstrumentName,
      s.adminOverride, s.lastConfirmedAt, s.createdAt, s.updatedAt,
    ])
  } else if (table === 'sms-campaigns') {
    const { campaigns } = await listCampaigns({ page: 1, pageSize: TABLE_EXPORT_ROW_CAP, status: filters.status, q: filters.q })
    targetType = 'SmsCampaign'
    header = ['ID', 'Name', 'Status', 'Messages', 'First day', 'Last day', 'Created by', 'Created']
    rows = campaigns.map((c) => [
      c.id, c.name, c.status, c.messages.length,
      c.messages[0]?.day.toISOString().slice(0, 10),
      c.messages[c.messages.length - 1]?.day.toISOString().slice(0, 10),
      c.creator?.fullName, c.createdAt,
    ])
  } else {
    const { items } = await listEmailLogs({
      ...page,
      status: filters.status,
      type: filters.type,
      deliveryStatus: filters.deliveryStatus,
      search: filters.search,
    })
    targetType = 'EmailLog'
    header = ['ID', 'Type', 'To', 'Subject', 'Status', 'Delivery', 'Provider', 'Error', 'Sent']
    rows = items.map((e) => [e.id, e.type, e.to, e.subject, e.status, e.deliveryStatus, e.provider, e.error, e.sentAt])
  }

  await createAuditLog(adminId, AUDIT_ACTIONS.EXPORT_TABLE_CSV, targetType, 'csv', {
    table,
    rows: rows.length,
    from: dateFrom.toISOString(),
    to: dateTo.toISOString(),
  })
  return toCsv(header, rows)
}
