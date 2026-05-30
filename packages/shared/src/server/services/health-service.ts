import { prisma } from '../db'

export async function checkDatabaseHealth() {
  await prisma.$queryRaw`SELECT 1`
}
