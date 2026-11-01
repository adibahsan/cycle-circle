import { withCronAuth } from '@vesta/shared/server/middleware'
import { ApiError } from '@vesta/shared/server/api-error'
import { runReport, isCronEnabled } from '@vesta/shared/server/services'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/cron/reports?kind=weekly|monthly
 *
 * Emails the Overview report to the recipients set on the System page, with the CSV attached.
 * Weekly: the previous 7 complete Bangladesh days (host cron, Sunday 03:00 UTC = 09:00 Bangladesh).
 * Monthly: the previous calendar month (host cron, 1st at 03:00 UTC).
 *
 * Protected by withCronAuth. Switchable on the System page. Each period is sent once: a repeated
 * hit returns `already-sent`. `force=true` sends again (manual re-send only).
 */
const handler = withCronAuth(async (request) => {
  const url = new URL(request.url)
  const kind = url.searchParams.get('kind')
  if (kind !== 'weekly' && kind !== 'monthly') {
    throw new ApiError(400, 'kind must be weekly or monthly', 'VALIDATION_ERROR')
  }
  if (!(await isCronEnabled('reports'))) {
    return Response.json({ skipped: true, reason: 'cron disabled' })
  }
  return Response.json(await runReport(kind, new Date(), { force: url.searchParams.get('force') === 'true' }))
})

export const GET = handler
export const POST = handler
