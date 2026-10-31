/**
 * Seeded read-only users (packages/shared/prisma/seed.ts). Global setup logs each in once
 * per run through the real OTP flow; tests reuse the saved state and must never change
 * their data: anything that saves uses a throwaway user (`newUser`).
 */
import path from 'node:path'
import { AUTH_DIR } from './slot.ts'

export const PERSONAS = {
  /** Rina, Pro, 7-day symptom streak. */
  streaker: { phone: '01700000001' },
  /** Sultana, Pro, 5-day streak mixing "all good" check-ins. */
  allGood: { phone: '01700000002' },
  /** Nasrin, Pro, last log 8 days ago. */
  stale: { phone: '01700000003' },
  /** Farida, Pro, 8+ periods, tier-2 prediction. */
  power: { phone: '01700000004' },
  /** Mitu, Pro, 1 profile with 1 period and no symptoms. */
  newUser: { phone: '01700000005' },
  /** Karim, Pro, 3 profiles. */
  proMulti: { phone: '01700000007' },
} as const

export type PersonaName = keyof typeof PERSONAS

/** Storage-state file for a persona (web) or for the seeded super admin (`admin`). */
export const statePath = (who: PersonaName | 'admin') => path.join(AUTH_DIR, `${who}.json`)
