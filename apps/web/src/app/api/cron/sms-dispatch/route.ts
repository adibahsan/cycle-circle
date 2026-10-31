import { withCronAuth } from '@vesta/shared/server/middleware'
import { runSmsDispatch, isCronEnabled } from '@vesta/shared/server/services'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/cron/sms-dispatch
 *
 * The SMS step on its own: marks past unsent days missed and, once the daily send time
 * (System page, Bangladesh time) has passed, sends today's planned campaign message.
 * Sends no reminder emails. Call it every 15 minutes so the send time can be any HH:MM;
 * repeated calls are safe (a message is claimed once and sent once).
 *
 * Protected by withCronAuth. Honours the same on/off switch as daily-reminders.
 */
const handler = withCronAuth(async () => {
  if (!(await isCronEnabled('daily-reminders'))) {
    return Response.json({ skipped: true, reason: 'cron disabled' })
  }
  return Response.json(await runSmsDispatch(new Date()))
})

export const GET = handler
export const POST = handler
