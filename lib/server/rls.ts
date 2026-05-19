import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/server/db'

/**
 * Executes `fn` inside a Prisma interactive transaction with the PostgreSQL
 * session variable `app.current_user_id` set to `userId` via SET LOCAL.
 *
 * This enables Row-Level Security policies that reference
 * `current_setting('app.current_user_id')` to scope queries automatically.
 *
 * The userId is passed as a parameterised query to prevent SQL injection.
 */
export async function withRLS<T>(
  userId: string,
  fn: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
    // Use parameterised $executeRaw to prevent SQL injection
    await tx.$executeRaw`SET LOCAL app.current_user_id = ${userId}`
    return fn(tx)
  })
}
