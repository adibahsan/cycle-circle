import { format } from 'date-fns'
import type {
  AuthMethod,
  FlowIntensity,
  Language,
  PeriodLog,
  Prediction,
  PredictionTier,
  ProfileRelation,
  SubscriptionStatus,
  SymptomCategory,
  SymptomLog,
  User,
  UserProfile,
} from '@vesta/shared/types'

function toDateString(value: string | Date | null | undefined): string {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : value
  return format(d, 'yyyy-MM-dd')
}

export function mapApiUser(raw: Record<string, unknown>): User {
  const authMethod = String(raw.authMethod ?? 'OTP').toUpperCase()
  const subscription = String(raw.subscriptionStatus ?? 'FREE').toLowerCase()
  const language = String(raw.language ?? 'EN').toLowerCase()

  return {
    id: String(raw.id),
    phone: String(raw.phone ?? '').replace(/^tel:/, ''),
    email: raw.email ? String(raw.email) : undefined,
    fullName: String(raw.fullName ?? ''),
    authMethod: (authMethod === 'EMAIL' ? 'email' : 'otp') as AuthMethod,
    subscriptionStatus: subscription as SubscriptionStatus,
    language: language as Language,
    emailTrialExpiresAt: raw.emailTrialExpiresAt
      ? new Date(String(raw.emailTrialExpiresAt)).toISOString()
      : undefined,
    profileCompleted: Boolean(raw.profileCompleted),
    createdAt: raw.createdAt
      ? new Date(String(raw.createdAt)).toISOString()
      : new Date().toISOString(),
  }
}

export function mapPartialAuthUser(raw: {
  id: string
  phone?: string | null
  profileCompleted: boolean
}): User {
  return mapApiUser({
    id: raw.id,
    phone: raw.phone,
    profileCompleted: raw.profileCompleted,
    authMethod: 'OTP',
    subscriptionStatus: 'FREE',
    language: 'EN',
  })
}

function mapPredictionTier(raw: string | undefined): PredictionTier {
  const tier = String(raw ?? 'AVERAGE').toLowerCase()
  if (tier === 'arima' || tier === 'lstm') return tier
  return 'average'
}

export function mapApiPrediction(raw: Record<string, unknown>, profileId: string): Prediction {
  return {
    profileId,
    tier: mapPredictionTier(raw.tier as string | undefined),
    nextPeriodStart: toDateString(raw.nextPeriodStart as string | Date | null),
    ovulationDay: toDateString(raw.ovulationDay as string | Date | null),
    fertileStart: toDateString(raw.fertileStart as string | Date | null),
    fertileEnd: toDateString(raw.fertileEnd as string | Date | null),
    confidence: Number(raw.confidence ?? 40),
  }
}

export function mapApiProfile(
  raw: Record<string, unknown>,
  prediction?: Record<string, unknown> | null,
): UserProfile {
  const relation = String(raw.relation ?? 'SELF').toLowerCase() as ProfileRelation
  const lastPeriodStart =
    toDateString(raw.lastPeriodStart as string | Date | null) ||
    format(new Date(), 'yyyy-MM-dd')

  return {
    id: String(raw.id),
    userId: String(raw.userId),
    name: String(raw.name),
    relation,
    cycleLength: Number(raw.cycleLength ?? 28),
    periodLength: Number(raw.periodLength ?? 5),
    lastPeriodStart,
    cycleHistory: [],
    predictionTier: prediction
      ? mapPredictionTier(prediction.tier as string | undefined)
      : 'average',
    createdAt: raw.createdAt
      ? new Date(String(raw.createdAt)).toISOString()
      : new Date().toISOString(),
  }
}

export function mapApiPeriodLog(raw: Record<string, unknown>): PeriodLog {
  const flow = String(raw.flowIntensity ?? 'MEDIUM').toLowerCase() as FlowIntensity

  return {
    id: String(raw.id),
    profileId: String(raw.profileId),
    startDate: toDateString(raw.startDate as string | Date),
    endDate: toDateString(raw.endDate as string | Date),
    flowIntensity: flow,
  }
}

export function mapApiSymptomLog(raw: Record<string, unknown>): SymptomLog {
  const category = String(raw.category ?? 'PHYSICAL').toLowerCase() as SymptomCategory

  return {
    id: String(raw.id),
    profileId: String(raw.profileId),
    date: toDateString(raw.date as string | Date),
    category,
    symptomId: String(raw.symptomId),
    value: String(raw.value ?? raw.symptomId),
  }
}

export function toApiRelation(relation: ProfileRelation): string {
  return relation.toUpperCase()
}

export function toApiFlowIntensity(flow: FlowIntensity): string {
  return flow.toUpperCase()
}
