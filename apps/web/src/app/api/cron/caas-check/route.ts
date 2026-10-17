import { withCronAuth } from '@vesta/shared/server/middleware'
import { revalidateTag } from 'next/cache'
import { cacheTags } from '@/lib/cache-tags'
import { handleApiError } from '@vesta/shared/server/api-error'
import {
  listBdappsSubscribers,
  applyBdappsSubscription,
  isCronEnabled,
} from '@vesta/shared/server/services'
import { getSubscriptionStatus, isPhoneSubscriberId } from '@vesta/shared/server/adapters/bdapps'
import { prisma } from '@vesta/shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Vercel Cron invokes the path with GET (and injects the Bearer CRON_SECRET);
// manual/admin triggers may POST. Export the same handler for both.
const handler = withCronAuth(async (request) => {
  // Only POST carries a JSON body. Calling request.json() on a bodyless GET
  // (how Vercel Cron invokes the schedule) throws, so guard by method.
  const body = (
    request.method === 'POST' ? await request.json().catch(() => ({})) : {}
  ) as { overrideDisabled?: boolean }
  if (!body.overrideDisabled && !(await isCronEnabled('caas-check'))) {
    return Response.json({ skipped: true, reason: 'cron disabled' })
  }
  try {
    // Keep Supabase Free tier alive (auto-pauses after 7 days of inactivity)
    await prisma.$queryRaw`SELECT 1`

    // CaaS balance checks return here when BDApps enables CaaS.
    const subscribers = await listBdappsSubscribers()

    let checked = 0
    let downgraded = 0
    let errors = 0
    let skipped = 0

    for (const sub of subscribers) {
      const { subscriberId } = sub
      checked++
      try {
        const status = await getSubscriptionStatus(subscriberId)
        if (status === 'UNREGISTERED' && isPhoneSubscriberId(subscriberId)) {
          // Masked-number apps reject raw phone ids with E1951, which reads as
          // UNREGISTERED: ambiguous, so never downgrade a legacy phone-id row.
          skipped++
        } else if (status === 'UNREGISTERED') {
          await applyBdappsSubscription(sub.userId, subscriberId, false, 'nightly-check')
          revalidateTag(cacheTags.user(sub.userId), { expire: 0 })
          downgraded++
        }
      } catch (err) {
        // Never downgrade on errors.
        errors++
        console.error(`BDApps subscription check failed for user ${sub.userId}:`, err)
      }
    }

    return Response.json({ checked, downgraded, skipped, errors })
  } catch (error) {
    return handleApiError(error)
  }
})

export const GET = handler
export const POST = handler
