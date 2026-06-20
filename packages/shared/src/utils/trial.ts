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
