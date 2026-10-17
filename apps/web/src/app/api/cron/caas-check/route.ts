import { withCronAuth } from '@vesta/shared/server/middleware'
import { revalidateTag } from 'next/cache'
import { cacheTags } from '@/lib/cache-tags'
import { handleApiError } from '@vesta/shared/server/api-error'
import {
  listBdappsSubscribers,
  applyBdappsSubscription,
  isCronEnabled,
} from '@vesta/shared/server/services'
import { getSubscriptionStatus } from '@vesta/shared/server/adapters/bdapps'
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

    for (const sub of subscribers) {
      const phone = sub.bdappsSubscriberId
      if (!phone) continue
      checked++
      try {
        const status = await getSubscriptionStatus(phone)
        if (status === 'UNREGISTERED') {
          await applyBdappsSubscription(sub.userId, phone, false)
          revalidateTag(cacheTags.user(sub.userId), { expire: 0 })
          downgraded++
        }
      } catch (err) {
        // Never downgrade on errors.
        errors++
        console.error(`BDApps subscription check failed for sub ${sub.id}:`, err)
      }
    }

    return Response.json({ checked, downgraded, errors })
  } catch (error) {
    return handleApiError(error)
  }
})

export const GET = handler
export const POST = handler
