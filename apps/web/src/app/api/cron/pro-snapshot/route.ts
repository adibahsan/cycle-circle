import { withCronAuth } from '@vesta/shared/server/middleware'
import { handleApiError } from '@vesta/shared/server/api-error'
import { snapshotProCount } from '@vesta/shared/server/services'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * POST /api/cron/pro-snapshot
 *
 * Nightly Pro subscriber count for the current Bangladesh day (host crontab, 17:55 UTC =
 * 23:55 Bangladesh time). Re-running the same day overwrites. Protected by withCronAuth.
 */
const handler = withCronAuth(async () => {
  try {
    return Response.json(await snapshotProCount(new Date()))
  } catch (error) {
    return handleApiError(error)
  }
})

export const GET = handler
export const POST = handler
