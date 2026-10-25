'use server'

import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { requireAuth, getAuthUser } from '@vesta/shared/server/auth'
import {
  createPeriodLog as svcCreatePeriodLog,
  updatePeriodLog as svcUpdatePeriodLog,
  deletePeriodLog as svcDeletePeriodLog,
  toggleSymptomLog,
  setAllGoodToday,
  recalculatePrediction,
  saveSymptomLogs,
} from '@vesta/shared/server/services'
import { ApiError } from '@vesta/shared/server/api-error'
import { cacheTags } from '@/lib/cache-tags'

const createPeriodLogSchema = z.object({
  profileId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  flowIntensity: z.enum(['LIGHT', 'MEDIUM', 'HEAVY']),
})

/**
 * Server-action errors are scrubbed in production (only a digest reaches the client), so an
 * expected overlap is returned as a value the client can read instead of thrown.
 */
export type PeriodOverlapResult = { error: 'PERIOD_OVERLAP' }

function asOverlap(err: unknown): PeriodOverlapResult | null {
  return err instanceof ApiError && err.code === 'PERIOD_OVERLAP' ? { error: 'PERIOD_OVERLAP' } : null
}

export async function createPeriodLog(input: z.infer<typeof createPeriodLogSchema>) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)
  const data = createPeriodLogSchema.parse(input)

  let created
  try {
    created = await svcCreatePeriodLog(data.profileId, user.id, {
      startDate: data.startDate,
      endDate: data.endDate,
      flowIntensity: data.flowIntensity,
    })
  } catch (err) {
    const overlap = asOverlap(err)
    if (overlap) return overlap
    throw err
  }
  const { log, shouldRecalcPrediction } = created

  if (shouldRecalcPrediction) {
    await recalculatePrediction(data.profileId)
  }
  revalidateTag(cacheTags.tracking(data.profileId), { expire: 0 })
  return log
}

const updatePeriodLogSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  flowIntensity: z.enum(['LIGHT', 'MEDIUM', 'HEAVY']).optional(),
})

export async function updatePeriodLog(logId: string, input: z.infer<typeof updatePeriodLogSchema>) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)
  const data = updatePeriodLogSchema.parse(input)

  let updated
  try {
    updated = await svcUpdatePeriodLog(logId, user.id, data)
  } catch (err) {
    const overlap = asOverlap(err)
    if (overlap) return overlap
    throw err
  }
  const { log, profileId, shouldRecalcPrediction } = updated

  if (shouldRecalcPrediction) {
    await recalculatePrediction(profileId)
  }
  revalidateTag(cacheTags.tracking(profileId), { expire: 0 })
  return log
}

export async function deletePeriodLog(logId: string) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)

  const { profileId, shouldRecalcPrediction } = await svcDeletePeriodLog(logId, user.id)

  if (shouldRecalcPrediction) {
    await recalculatePrediction(profileId)
  }
  revalidateTag(cacheTags.tracking(profileId), { expire: 0 })
}

const createSymptomSchema = z.object({
  profileId: z.string().min(1),
  date: z.string().min(1),
  category: z.enum(['PHYSICAL', 'MOOD', 'DISCHARGE', 'LIFESTYLE']),
  symptomId: z.string().min(1),
  value: z.string().min(1),
})

export async function toggleSymptom(input: z.infer<typeof createSymptomSchema>) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)
  const data = createSymptomSchema.parse(input)

  await toggleSymptomLog(data.profileId, user.id, {
    date: data.date,
    category: data.category,
    symptomId: data.symptomId,
    value: data.value,
  })

  revalidateTag(cacheTags.symptoms(data.profileId), { expire: 0 })
  revalidateTag(cacheTags.tracking(data.profileId), { expire: 0 })
}

const allGoodSchema = z.object({
  profileId: z.string().min(1),
  date: z.string().optional(),
})

export async function markAllGoodToday(profileId: string, date?: string) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)
  const data = allGoodSchema.parse({ profileId, date })

  await setAllGoodToday(data.profileId, user.id, data.date)

  revalidateTag(cacheTags.symptoms(data.profileId), { expire: 0 })
  revalidateTag(cacheTags.tracking(data.profileId), { expire: 0 })
}

const saveSymptomsSchema = z.object({
  profileId: z.string().min(1),
  date: z.string().min(1),
  added: z.array(
    z.object({
      symptomId: z.string().min(1),
      category: z.enum(['PHYSICAL', 'MOOD', 'DISCHARGE', 'LIFESTYLE']),
      value: z.string().min(1),
    }),
  ),
  removed: z.array(z.string().min(1)),
})

export async function saveSymptoms(input: z.infer<typeof saveSymptomsSchema>) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)
  const data = saveSymptomsSchema.parse(input)

  const result = await saveSymptomLogs(data.profileId, user.id, {
    date: data.date,
    added: data.added,
    removed: data.removed,
  })

  revalidateTag(cacheTags.symptoms(data.profileId), { expire: 0 })
  revalidateTag(cacheTags.tracking(data.profileId), { expire: 0 })
  return result
}
