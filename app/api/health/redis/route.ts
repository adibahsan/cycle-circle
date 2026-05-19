import { redis } from '@/lib/server/adapters/redis'

export async function GET() {
  try {
    const start = Date.now()
    await redis.ping()
    return Response.json({ status: 'ok', latency: Date.now() - start })
  } catch (e) {
    return Response.json({ status: 'error', message: String(e) }, { status: 503 })
  }
}
