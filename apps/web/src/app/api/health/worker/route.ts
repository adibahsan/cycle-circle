import { redis } from '@vesta/shared/server/adapters/redis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  if (!redis) {
    return Response.json({ ok: false, error: 'redis not configured' })
  }
  const ts = await redis.get('worker:cron:heartbeat')
  if (!ts) {
    return Response.json({ ok: false, lastHeartbeat: null })
  }
  const staleSeconds = Math.round((Date.now() - new Date(ts).getTime()) / 1000)
  return Response.json({ ok: staleSeconds < 90, lastHeartbeat: ts, staleSeconds })
}
