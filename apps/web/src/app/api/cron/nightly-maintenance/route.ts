import { withCronAuth } from '@vesta/shared/server/middleware'
import { handleApiError } from '@vesta/shared/server/api-error'
import { runNightlyMaintenance } from '@vesta/shared/server/services'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/cron/nightly-maintenance
 *
 * Nightly admin maintenance (02:30 UTC, host crontab): stores the dated
 * per-tier prediction-accuracy snapshot and purges accounts deleted more than
 * 30 days ago (ADR 0006). Protected by withCronAuth (Bearer CRON_SECRET).
 */
const handler = withCronAuth(async () => {
  try {
    return Response.json(await runNightlyMaintenance(new Date()))
  } catch (error) {
    return handleApiError(error)
  }
})

export const GET = handler
export const POST = handler
