/**
 * Named API mocks for states that are hard to reach with real data.
 * Add a mock: put an entry in MOCKS. `status` patches /api/auth/status `user`,
 * `logging` patches /api/tracking/logging-status.
 */
type Json = Record<string, unknown>
type Ctx = { now: Date }
interface MockDef {
  status?: (ctx: Ctx) => Json
  logging?: (ctx: Ctx) => Json
}

const iso = (d: Date, deltaMs: number) => new Date(d.getTime() + deltaMs).toISOString()
const DAY = 86_400_000

export const MOCKS: Record<string, MockDef> = {
  'free-user': {
    status: ({ now }) => ({ subscriptionStatus: 'FREE', isPro: false, onboardingTourCompletedAt: iso(now, -DAY) }),
  },
  'trial-expired': {
    status: ({ now }) => ({
      authMethod: 'EMAIL', subscriptionStatus: 'FREE',
      emailTrialExpiresAt: iso(now, -DAY), onboardingTourCompletedAt: iso(now, -DAY),
    }),
  },
  'email-trial': {
    status: ({ now }) => ({
      authMethod: 'EMAIL', subscriptionStatus: 'FREE', phone: null,
      emailTrialExpiresAt: iso(now, 5 * 3_600_000), onboardingTourCompletedAt: iso(now, -DAY),
    }),
  },
  'late-period': {
    logging: () => ({ isPeriodLate: true, daysLate: 4 }),
  },
}

export function applyStatusMock(body: Json, names: string[], now = new Date()): Json {
  const user = { ...((body.user as Json) ?? {}) }
  for (const n of names) Object.assign(user, MOCKS[n]?.status?.({ now }) ?? {})
  return { ...body, user }
}

export function applyLoggingMock(body: Json, names: string[], now = new Date()): Json {
  const out = { ...body }
  for (const n of names) Object.assign(out, MOCKS[n]?.logging?.({ now }) ?? {})
  return out
}
