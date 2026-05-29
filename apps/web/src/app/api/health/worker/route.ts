import { prisma } from '@vesta/shared'

export async function GET() {
  try {
    const start = Date.now()
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

    const latency = Date.now() - start
    const active = recentCompleted > 0 || recentProcessing > 0

    return Response.json({
      status: 'ok',
      latency,
      worker: {
        active,
        recentCompleted,
        recentProcessing,
        pendingQueue: pendingCount,
      },
    })
  } catch (e) {
    return Response.json({ status: 'error', message: String(e) }, { status: 503 })
  }
}
