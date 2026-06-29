import { withCronAuth } from '@vesta/shared/server/middleware'
import { runDailyReminders, dispatchScheduledBroadcast } from '@vesta/shared/server/services'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/cron/daily-reminders
 *
 * Runs at 08:00 UTC every day. Sends period alerts, fertile-window alerts,
 * logging reminders, and profile-completion reminders, then dispatches the
 * day's scheduled SMS content broadcast (FR-SMS — folded in here to stay within
 * the 2-job Vercel Hobby cron budget).
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
// Vercel Cron invokes the path with GET (and injects the Bearer CRON_SECRET);
// manual/admin triggers may POST. Export the same handler for both.
const handler = withCronAuth(async (request) => {
  const body = (await request.json().catch(() => ({}))) as {
    userId?: string
    force?: boolean
  }
  const result = await runDailyReminders({ userId: body.userId, force: body.force })

  // Send the day's scheduled SMS broadcast (one per day). Failures here must not
  // fail the reminder run, so it is reported alongside rather than thrown.
  const smsBroadcast = await dispatchScheduledBroadcast().catch((err: unknown) => ({
    dispatched: false as const,
    error: String(err),
  }))

  return Response.json({ ...result, smsBroadcast })
})

export const GET = handler
export const POST = handler
