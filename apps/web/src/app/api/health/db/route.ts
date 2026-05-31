import { checkDatabaseHealth } from '@vesta/shared/server/services'

export async function GET() {
  try {
    const start = Date.now()
    await checkDatabaseHealth()
    return Response.json({ status: 'ok', latency: Date.now() - start })
  } catch (e) {
    return Response.json({ status: 'error', message: String(e) }, { status: 503 })
  }
}
