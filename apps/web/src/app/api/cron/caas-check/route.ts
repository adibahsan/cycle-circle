import { withCronAuth } from '@vesta/shared/server/middleware'
import { revalidateTag } from 'next/cache'
import { cacheTags } from '@/lib/cache-tags'
import { handleApiError } from '@vesta/shared/server/api-error'
import { runDailySubscriptionCheck } from '@vesta/shared/server/services'
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
  try {
    // Keep Supabase Free tier alive (auto-pauses after 7 days of inactivity)
    await prisma.$queryRaw`SELECT 1`

    // Today this job only reads subscriber status (getSubscriptionStatus); it makes no BDApps charge calls.
    // The scheduled call never sets overrideDisabled; the admin's "Run now" always does.
    const result = await runDailySubscriptionCheck({
      trigger: body.overrideDisabled ? 'MANUAL' : 'CRON',
      now: new Date(),
      clock: () => new Date(),
      overrideDisabled: !!body.overrideDisabled,
    })
    if (result.status === 'SKIPPED') {
      return Response.json({ skipped: true, reason: 'cron disabled', runId: result.runId })
    }
    for (const userId of [...result.movedUserIds, ...result.reinstatedUserIds]) {
      revalidateTag(cacheTags.user(userId), { expire: 0 })
    }
    return Response.json({
      runId: result.runId,
      checked: result.checked,
      downgraded: result.moved,
      skipped: result.skipped,
      errors: result.errors,
      reinstated: result.reinstated,
    })
  } catch (error) {
    return handleApiError(error)
  }
})

export const GET = handler
export const POST = handler
