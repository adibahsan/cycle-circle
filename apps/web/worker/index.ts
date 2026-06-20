import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'
const TARGET = process.env.WORKER_TARGET_URL ?? 'http://localhost:3000'
const SECRET = process.env.CRON_SECRET ?? ''
const QUEUE = 'vesta-cron'

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null })

const JOBS = [
  { name: 'daily-reminders', path: '/api/cron/daily-reminders', pattern: process.env.REMINDERS_CRON ?? '0 8 * * *' },
  { name: 'caas-check', path: '/api/cron/caas-check', pattern: process.env.CAAS_CRON ?? '0 2 * * *' },
]

async function trigger(path: string, name: string): Promise<void> {
  const res = await fetch(`${TARGET}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SECRET}` },
  })
  const body = await res.text()
  console.log(`[worker] ${name} -> ${res.status} ${body}`)
  if (!res.ok) throw new Error(`${name} failed: ${res.status} ${body}`)
}

async function main(): Promise<void> {
  const queue = new Queue(QUEUE, { connection })

  for (const j of JOBS) {
    await queue.upsertJobScheduler(
      j.name,
      { pattern: j.pattern, tz: 'UTC' },
      {
        name: j.name,
        data: { path: j.path },
        opts: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
          removeOnFail: 50,
        },
      },
    )
  }

  new Worker(
    QUEUE,
    async (job) => {
      await trigger(job.data.path as string, job.name)
    },
    { connection },
  )

  if (process.env.RUN_ON_BOOT === 'true') {
    for (const j of JOBS) {
      try {
        await trigger(j.path, j.name)
      } catch (err) {
        console.error(`[worker] boot trigger ${j.name} failed:`, err)
      }
    }
  }

  setInterval(() => {
    connection.set('worker:cron:heartbeat', new Date().toISOString(), 'EX', 90).catch(() => {})
  }, 30_000)

  console.log(`[worker] cron scheduler up; target=${TARGET}; reminders=${JOBS[0].pattern}; caas=${JOBS[1].pattern}`)
}

main().catch((err) => {
  console.error('[worker] fatal:', err)
  process.exit(1)
})
