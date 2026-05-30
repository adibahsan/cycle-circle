import { prisma } from '../db'

export async function checkDatabaseHealth() {
  await prisma.$queryRaw`SELECT 1`
}

export async function getWorkerStats() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

  const [recentCompleted, recentProcessing, pendingCount] = await Promise.all([
    prisma.jobEvent.count({
      where: {
        status: 'COMPLETED',
        completedAt: { gte: fiveMinutesAgo },
      },
    }),
    prisma.jobEvent.count({
      where: {
        status: 'PROCESSING',
        startedAt: { gte: fiveMinutesAgo },
      },
    }),
    prisma.jobEvent.count({
      where: { status: 'PENDING' },
    }),
  ])

  return {
    active: recentCompleted > 0 || recentProcessing > 0,
    recentCompleted,
    recentProcessing,
    pendingQueue: pendingCount,
  }
}
