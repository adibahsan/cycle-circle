import { withCronAuth } from '@vesta/shared/server/middleware'
import { handleApiError } from '@vesta/shared/server/api-error'
import { listProSubscriptions, recordSubscriptionCheckResult } from '@vesta/shared/server/services'
import { caasGetBalance } from '@vesta/shared/server/adapters/bdapps'
import { prisma } from '@vesta/shared'

export const POST = withCronAuth(async (_request) => {
  try {
    // Keep Supabase Free tier alive (auto-pauses after 7 days of inactivity)
    await prisma.$queryRaw`SELECT 1`

    const proSubscriptions = await listProSubscriptions()

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
          const isHealthy = result.statusCode === 'S1000'

          if (isHealthy) healthy++
          else failures++

          await recordSubscriptionCheckResult(
            sub.id,
            sub.userId,
            isHealthy,
            sub.consecutiveFailures,
          )
        } catch (err) {
          failures++
          console.error(`CAAS balance check failed for sub ${sub.id}:`, err)
          await recordSubscriptionCheckResult(
            sub.id,
            sub.userId,
            false,
            sub.consecutiveFailures,
          )
        }
      }),
    )

    return Response.json({ checked, healthy, failures })
  } catch (error) {
    return handleApiError(error)
  }
})
