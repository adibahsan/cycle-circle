export type TrialStatus = 'none' | 'active' | 'expired'

type TrialUser = {
  authMethod?: string | null
  subscriptionStatus?: string | null
  emailTrialExpiresAt?: Date | string | null
}

export function getTrialStatus(u: TrialUser): TrialStatus {
  if (u.authMethod !== 'EMAIL' || u.subscriptionStatus !== 'FREE' || !u.emailTrialExpiresAt) return 'none'
  const exp = new Date(u.emailTrialExpiresAt).getTime()
  return Date.now() > exp ? 'expired' : 'active'
}

export function isTrialExpired(u: TrialUser): boolean {
  return getTrialStatus(u) === 'expired'
}

export function getTrialHoursLeft(expiresAt?: Date | string | null): number | null {
  if (!expiresAt) return null
  const diff = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.floor(diff / 3_600_000))
}

/**
 * Milliseconds remaining in an ACTIVE email trial (for a live per-second
 * countdown). Returns null when the trial is not active (none/expired), so a
 * caller can stop ticking and let the expired-lock take over.
 */
export function getTrialMsLeft(u: TrialUser): number | null {
  if (getTrialStatus(u) !== 'active' || !u.emailTrialExpiresAt) return null
  return Math.max(0, new Date(u.emailTrialExpiresAt).getTime() - Date.now())
}
