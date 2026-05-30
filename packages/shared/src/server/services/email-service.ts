import type { DeliveryStatus, EmailType } from '@prisma/client'
import { prisma } from '../db'

// ── List ───────────────────────────────────────────────────────────────────────

export interface EmailLogListParams {
  page?: number
  pageSize?: number
  type?: string
  status?: string
  deliveryStatus?: string
  userId?: string
  search?: string
}

export async function listEmailLogs(params: EmailLogListParams = {}) {
  const {
    page = 1,
    pageSize = 20,
    type,
    status,
    deliveryStatus,
    userId,
    search,
  } = params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}

  if (type) where.type = type
  if (status) where.status = status
  if (deliveryStatus) where.deliveryStatus = deliveryStatus
  if (userId) where.userId = userId
  if (search) {
    where.OR = [
      { to: { contains: search, mode: 'insensitive' } },
      { subject: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [items, total] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        profile: { select: { id: true, name: true } },
      },
      orderBy: { sentAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.emailLog.count({ where }),
  ])

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

// ── Stats ──────────────────────────────────────────────────────────────────────

export async function getEmailLogStats() {
  const [total, byTypeRows, byStatusRows, byProviderRows] = await Promise.all([
    prisma.emailLog.count(),
    prisma.emailLog.groupBy({ by: ['type'], _count: { _all: true } }),
    prisma.emailLog.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.emailLog.groupBy({ by: ['provider'], _count: { _all: true } }),
  ])

  const byType: Record<string, number> = {}
  for (const row of byTypeRows) {
    byType[row.type] = row._count._all
  }

  const byStatus: Record<string, number> = {}
  for (const row of byStatusRows) {
    byStatus[row.status] = row._count._all
  }

  const byProvider: Record<string, number> = {}
  for (const row of byProviderRows) {
    byProvider[row.provider] = row._count._all
  }

  return { total, byType, byStatus, byProvider }
}

// ── Get by ID ──────────────────────────────────────────────────────────────────

export async function getEmailLogById(id: string) {
  return prisma.emailLog.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, fullName: true, email: true } },
      profile: { select: { id: true, name: true } },
    },
  })
}

// ── Dedup helper (used by cron) ────────────────────────────────────────────────

export async function wasEmailSentToday(
  type: EmailType,
  profileId: string,
): Promise<boolean> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const existing = await prisma.emailLog.findFirst({
    where: { type, profileId, sentAt: { gte: today }, status: 'SENT' },
  })
  return !!existing
}

// ── Webhook delivery update ────────────────────────────────────────────────────

export async function updateEmailDeliveryStatus(
  resendId: string,
  deliveryStatus: DeliveryStatus,
): Promise<void> {
  await prisma.emailLog.updateMany({
    where: { resendId },
    data: { deliveryStatus },
  })
}
