import { prisma } from '../db'
import { Prisma } from '@prisma/client'

export async function createAuditLog(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: Prisma.InputJsonValue,
) {
  return prisma.adminAuditLog.create({
    data: { adminId, action, targetType, targetId, metadata: metadata ?? Prisma.JsonNull },
  })
}

export async function listAuditLogs(params: {
  page?: number
  pageSize?: number
  action?: string
  targetType?: string
  adminId?: string
}) {
  const { page = 1, pageSize = 20, action, targetType, adminId } = params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}

  if (action) where.action = action
  if (targetType) where.targetType = targetType
  if (adminId) where.adminId = adminId

  const [logs, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      include: {
        admin: {
          select: { fullName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.adminAuditLog.count({ where }),
  ])

  return {
    logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}
