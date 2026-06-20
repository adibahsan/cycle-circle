import { withCronAuth } from '@vesta/shared/server/middleware'
import { runDailyReminders } from '@vesta/shared/server/services'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/cron/daily-reminders
 *
 * Runs at 08:00 UTC every day. Sends period alerts, fertile-window alerts,
 * logging reminders, and profile-completion reminders.
 *
 * Protected by withCronAuth (Authorization: Bearer <CRON_SECRET>).
 *
 * Optional JSON body (Vercel Cron sends none — handled gracefully):
 *   { userId?: string; force?: boolean }
 *
 * When `userId` is provided, only that user's profiles/reminders are processed.
 * When `force` is true, the per-day dedup checks are skipped so an admin can
 * re-trigger a specific user's reminder emails on demand.
 */
export const POST = withCronAuth(async (request) => {
  const body = (await request.json().catch(() => ({}))) as {
    userId?: string
    force?: boolean
  }
  const result = await runDailyReminders({ userId: body.userId, force: body.force })
  return Response.json(result)
})
