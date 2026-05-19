import { prisma } from '@/lib/server/db'
import type { JobEvent } from '@prisma/client'

export type JobType = 'PREDICTION_RECALC' | 'SEND_EMAIL' | 'SMS_BROADCAST'

/**
 * Enqueue a new job by writing a PENDING record to the JobEvent table.
 * In production this table can be consumed by a dedicated worker process;
 * in development a simple polling loop suffices.
 */
export async function enqueueJob(
  type: JobType,
  payload: Record<string, unknown>,
): Promise<JobEvent> {
  return prisma.jobEvent.create({
    data: {
      type,
      payload,
      status: 'PENDING',
    },
  })
}

/**
 * Atomically claim the oldest PENDING job using `FOR UPDATE SKIP LOCKED` so
 * multiple concurrent workers never pick up the same record.
 *
 * Returns `null` when the queue is empty.
 */
export async function claimNextJob(): Promise<JobEvent | null> {
  const jobs = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "JobEvent"
    SET
      status      = 'PROCESSING',
      "startedAt" = NOW(),
      attempts    = attempts + 1
    WHERE id = (
      SELECT id
      FROM   "JobEvent"
      WHERE  status = 'PENDING'
      ORDER  BY "scheduledAt" ASC
      LIMIT  1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `

  if (!jobs.length) return null

  return prisma.jobEvent.findUnique({ where: { id: jobs[0].id } })
}

/**
 * Mark a job as successfully completed.
 */
export async function completeJob(id: string): Promise<JobEvent> {
  return prisma.jobEvent.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  })
}

/**
 * Mark a job as failed and record the error message for debugging.
 */
export async function failJob(id: string, error: string): Promise<JobEvent> {
  return prisma.jobEvent.update({
    where: { id },
    data: {
      status: 'FAILED',
      lastError: error,
    },
  })
}
