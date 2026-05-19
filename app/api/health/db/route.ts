import { prisma } from '@/lib/server/db'

export async function GET() {
  try {
    const start = Date.now()
    await prisma.$queryRaw`SELECT 1`
    return Response.json({ status: 'ok', latency: Date.now() - start })
  } catch (e) {
    return Response.json({ status: 'error', message: String(e) }, { status: 503 })
  }
}
