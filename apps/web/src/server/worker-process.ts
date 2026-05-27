// Standalone worker process
// Polls for PENDING jobs and processes them

import { prisma } from './db'

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

async function recalculatePrediction(profileId: string) {
  // Get all period logs for this profile
  const logs = await prisma.periodLog.findMany({
    where: { profileId },
    orderBy: { startDate: 'asc' }
  })

  if (logs.length === 0) return

  // Calculate cycle lengths
  const cycleLengths: number[] = []
  for (let i = 1; i < logs.length; i++) {
    const diff = Math.round((logs[i].startDate.getTime() - logs[i-1].startDate.getTime()) / (1000 * 60 * 60 * 24))
    if (diff > 0 && diff < 90) cycleLengths.push(diff)
  }

  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile) return

  // Determine tier
  const tier = cycleLengths.length >= 6 ? 'ARIMA' : 'AVERAGE'

  // Calculate average cycle length
  let avgCycle: number
  if (tier === 'ARIMA' && cycleLengths.length >= 6) {
    // Simple ARIMA-like: weighted moving average (recent cycles weigh more)
    const recent = cycleLengths.slice(-6)
    const weights = [1, 1.5, 2, 2.5, 3, 3.5]
    const totalWeight = weights.reduce((a, b) => a + b, 0)
    avgCycle = Math.round(recent.reduce((sum, len, i) => sum + len * weights[i], 0) / totalWeight)
  } else {
    avgCycle = cycleLengths.length > 0
      ? Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length)
      : profile.cycleLength
  }

  const lastLog = logs[logs.length - 1]
  const nextPeriodStart = new Date(lastLog.startDate)
  nextPeriodStart.setDate(nextPeriodStart.getDate() + avgCycle)

  const ovulationDay = new Date(nextPeriodStart)
  ovulationDay.setDate(ovulationDay.getDate() - 14)

  const fertileStart = new Date(ovulationDay)
  fertileStart.setDate(fertileStart.getDate() - 5)

  const fertileEnd = new Date(ovulationDay)
  fertileEnd.setDate(fertileEnd.getDate() + 1)

  // Confidence: increases with more data
  const confidence = Math.min(0.95, 0.5 + cycleLengths.length * 0.05)

  // Upsert prediction
  await prisma.prediction.upsert({
    where: { profileId },
    update: { tier, nextPeriodStart, ovulationDay, fertileStart, fertileEnd, confidence },
    create: { profileId, tier, nextPeriodStart, ovulationDay, fertileStart, fertileEnd, confidence }
  })

  console.log(`[worker] Prediction updated for profile ${profileId}: tier=${tier}, confidence=${confidence}`)
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
