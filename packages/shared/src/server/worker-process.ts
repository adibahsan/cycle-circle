// Standalone worker process
// Polls for PENDING jobs and processes them

import { prisma } from './db'
import { recalculatePrediction } from './prediction-calc'

const POLL_INTERVAL = 2000 // 2 seconds

async function processJob(job: { id: string; type: string; payload: any }) {
  console.log(`[worker] Processing job ${job.id} type=${job.type}`)

  switch (job.type) {
    case 'PREDICTION_RECALC':
      await recalculatePrediction(job.payload.profileId)
      break
    case 'SEND_EMAIL':
      console.log(`[worker] Email job:`, job.payload)
      break
    case 'SMS_BROADCAST':
      console.log(`[worker] SMS broadcast job:`, job.payload)
      break
    default:
      console.log(`[worker] Unknown job type: ${job.type}`)
  }
}

async function pollLoop() {
  console.log('[worker] Starting job consumer...')
  while (true) {
    try {
      // Claim next job atomically
      const jobs = await prisma.$queryRaw<Array<{ id: string }>>`
        UPDATE "JobEvent" SET status = 'PROCESSING'::"JobStatus", "startedAt" = NOW(), attempts = attempts + 1
        WHERE id = (SELECT id FROM "JobEvent" WHERE status = 'PENDING'::"JobStatus" ORDER BY "scheduledAt" ASC LIMIT 1 FOR UPDATE SKIP LOCKED)
        RETURNING id
      `

      if (jobs.length > 0) {
        const job = await prisma.jobEvent.findUnique({ where: { id: jobs[0].id } })
        if (job) {
          try {
            await processJob(job)
            await prisma.jobEvent.update({ where: { id: job.id }, data: { status: 'COMPLETED', completedAt: new Date() } })
          } catch (err) {
            console.error(`[worker] Job ${job.id} failed:`, err)
            await prisma.jobEvent.update({ where: { id: job.id }, data: { status: 'FAILED', lastError: String(err) } })
          }
        }
      }
    } catch (err) {
      console.error('[worker] Poll error:', err)
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))
  }
}

pollLoop()
