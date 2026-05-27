import { withCronAuth } from '@/server/middleware'
import { handleApiError } from '@/server/api-error'
import { prisma } from '@/server/db'
import { caasGetBalance } from '@/server/adapters/bdapps'

interface ProSubscription {
  id: string
  userId: string
  bdappsSubscriberId: string | null
  consecutiveFailures: number
  user: { phone: string | null }
}

export const POST = withCronAuth(async (_request) => {
  try {
    const proSubscriptions = await prisma.subscription.findMany({
      where: { status: 'PRO' },
      include: { user: { select: { phone: true } } },
    }) as ProSubscription[]

    let checked = 0
    let healthy = 0
    let failures = 0

    await Promise.allSettled(
      proSubscriptions.map(async (sub) => {
        const phone = sub.user?.phone ?? sub.bdappsSubscriberId
        if (!phone) return

        checked++
        try {
          const result = await caasGetBalance(phone)
          if (result.statusCode === 'S1000') {
            healthy++
            await prisma.subscription.update({
              where: { id: sub.id },
              data: { consecutiveFailures: 0 },
            })
          } else {
            failures++
            const newFailures = sub.consecutiveFailures + 1
            await prisma.subscription.update({
              where: { id: sub.id },
              data: {
                consecutiveFailures: newFailures,
                status: newFailures >= 3 ? 'LAPSED' : 'PRO',
              },
            })
            if (newFailures >= 3) {
              await prisma.user.update({
                where: { id: sub.userId },
                data: { subscriptionStatus: 'LAPSED' },
              })
            }
          }
        } catch (err) {
          failures++
          const newFailures = sub.consecutiveFailures + 1
          console.error(`CAAS balance check failed for sub ${sub.id}:`, err)
          await prisma.subscription.update({
            where: { id: sub.id },
            data: {
              consecutiveFailures: newFailures,
              status: newFailures >= 3 ? 'LAPSED' : 'PRO',
            },
          })
          if (newFailures >= 3) {
            await prisma.user.update({
              where: { id: sub.userId },
              data: { subscriptionStatus: 'LAPSED' },
            })
          }
        }
      }),
    )

    return Response.json({ checked, healthy, failures })
  } catch (error) {
    return handleApiError(error)
  }
})
