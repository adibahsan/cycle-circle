/** Dev-login personas. Never use +8801700000099: backend:test owns it. */
export const PERSONAS = {
  /** Seeded "streaker" user with history (packages/shared/prisma/seed.ts). */
  seed: { phone: '01700000001' },
  /** Dedicated e2e user, created on first dev-login: empty profile, first-run flows. */
  fresh: { phone: '01700000777' },
  /** Dashboard-mode personas (#76), set up by ensureModePersonas: one profile each, read-only in tests. */
  pregnant: { phone: '01700000781' },
  menopause: { phone: '01700000782' },
  /** Standard goal, no period ever logged: the first-run dashboard. */
  firstRun: { phone: '01700000783' },
} as const

export type PersonaName = keyof typeof PERSONAS
