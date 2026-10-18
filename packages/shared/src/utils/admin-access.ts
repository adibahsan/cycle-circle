// Pure decision for the admin edge proxy — kept free of Next/jose imports so it is unit-testable.
export type AdminAccessDecision = 'allow' | 'redirect-login' | 'forbidden'

export function decideAdminAccess(input: {
  hasToken: boolean
  /** Verified JWT payload; null/undefined when verification failed. */
  payload?: { role?: unknown } | null
}): AdminAccessDecision {
  if (!input.hasToken || !input.payload) return 'redirect-login'
  return input.payload.role === 'ADMIN' ? 'allow' : 'forbidden'
}
