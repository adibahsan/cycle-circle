/**
 * Database setup helpers for E2E tests.
 *
 * Uses a slot-bound PrismaClient connected to the slot's vesta_e2e database.
 * Never imports from @vesta/shared (which reads default DATABASE_URL from .env).
 * Dates must come from the Bangladesh-day helper (days fixture).
 */
import { PrismaClient, type ProfileRelation, type FlowIntensity, type SymptomCategory, type PredictionTier } from '@prisma/client'
import { DATABASE_URL, assertE2eDatabase } from './slot.ts'

assertE2eDatabase()

const dbUrl = new URL(DATABASE_URL)
if (!dbUrl.searchParams.has('connection_limit')) {
  dbUrl.searchParams.set('connection_limit', '2')
}

export const db = new PrismaClient({ datasourceUrl: dbUrl.toString() })

/** Find the User record in DB matching a phone number (e.g. 0136XXXXXXX). */
export async function findUserByPhone(phone: string) {
  const digits = phone.replace(/\D/g, '').slice(-10)
  return db.user.findFirst({
    where: { phone: { contains: digits } },
    include: { profiles: true },
  })
}

export interface EnsureProfileOptions {
  name?: string
  relation?: ProfileRelation
  cycleLength?: number
  periodLength?: number
  lastPeriodStart?: Date | null
  goal?: string | null
  dismissTour?: boolean
}

/** Ensure a profile exists for the user and apply any overrides (e.g. goal, lengths). */
export async function ensureUserProfile(phone: string, options: EnsureProfileOptions = {}) {
  const user = await findUserByPhone(phone)
  if (!user) throw new Error(`User with phone ${phone} not found in database`)

  if (options.dismissTour !== false) {
    await db.user.update({
      where: { id: user.id },
      data: { onboardingTourCompletedAt: new Date() },
    })
  }

  const existing = user.profiles[0]
  if (existing) {
    return db.profile.update({
      where: { id: existing.id },
      data: {
        ...(options.name !== undefined && { name: options.name }),
        ...(options.relation !== undefined && { relation: options.relation }),
        ...(options.cycleLength !== undefined && { cycleLength: options.cycleLength }),
        ...(options.periodLength !== undefined && { periodLength: options.periodLength }),
        ...(options.lastPeriodStart !== undefined && { lastPeriodStart: options.lastPeriodStart }),
        ...(options.goal !== undefined && { goal: options.goal }),
      },
    })
  }

  return db.profile.create({
    data: {
      userId: user.id,
      name: options.name ?? 'Test User',
      relation: options.relation ?? 'SELF',
      cycleLength: options.cycleLength ?? 28,
      periodLength: options.periodLength ?? 5,
      lastPeriodStart: options.lastPeriodStart ?? null,
      goal: options.goal ?? 'track',
    },
  })
}

export interface PeriodLogInput {
  startDate: Date
  endDate: Date
  flowIntensity?: FlowIntensity
}

/** Replace period logs for a profile with the provided logs. */
export async function setPeriodLogs(profileId: string, logs: PeriodLogInput[]) {
  await db.periodLog.deleteMany({ where: { profileId } })
  if (logs.length === 0) return []

  const created = []
  for (const log of logs) {
    created.push(
      await db.periodLog.create({
        data: {
          profileId,
          startDate: log.startDate,
          endDate: log.endDate,
          flowIntensity: log.flowIntensity ?? 'MEDIUM',
        },
      }),
    )
  }
  return created
}

export interface SymptomLogInput {
  date: Date
  category: SymptomCategory
  symptomId: string
  value?: string
}

/** Add symptom logs for a profile. */
export async function setSymptomLogs(profileId: string, logs: SymptomLogInput[]) {
  if (logs.length === 0) return []

  const ops = logs.map((log) =>
    db.symptomLog.create({
      data: {
        profileId,
        date: log.date,
        category: log.category,
        symptomId: log.symptomId,
        value: log.value ?? log.symptomId,
      },
    }),
  )
  return db.$transaction(ops)
}

export interface PredictionInput {
  tier: PredictionTier
  nextPeriodStart: Date
  ovulationDay: Date
  fertileStart: Date
  fertileEnd: Date
  confidence: number
}

/** Set or update a prediction record for a profile. */
export async function setPrediction(profileId: string, pred: PredictionInput) {
  return db.prediction.upsert({
    where: { profileId },
    update: pred,
    create: { profileId, ...pred },
  })
}
