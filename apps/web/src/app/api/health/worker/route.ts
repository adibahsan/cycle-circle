import { getWorkerStats } from '@vesta/shared/server/services'

export async function GET() {
  try {
    const start = Date.now()
    const worker = await getWorkerStats()
    return Response.json({ status: 'ok', latency: Date.now() - start, worker })
  } catch (e) {
    return Response.json({ status: 'error', message: String(e) }, { status: 503 })
  }
}
