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
