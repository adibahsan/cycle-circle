/** Dev-login personas. Never use +8801700000099: backend:test owns it. */
export const PERSONAS = {
  /** Seeded "streaker" user with history (packages/shared/prisma/seed.ts). */
  seed: { phone: '01700000001' },
  /** Dedicated e2e user, created on first dev-login: empty profile, first-run flows. */
  fresh: { phone: '01700000777' },
} as const

export type PersonaName = keyof typeof PERSONAS
