import { redis } from '@vesta/shared/server/adapters/redis'

export async function GET() {
  if (!redis) {
    return Response.json({ status: 'skipped', mode: 'in-memory' })
  }
  try {
    const start = Date.now()
    await redis.ping()
    return Response.json({ status: 'ok', latency: Date.now() - start })
  } catch (e) {
    return Response.json({ status: 'error', message: String(e) }, { status: 503 })
  }
}
