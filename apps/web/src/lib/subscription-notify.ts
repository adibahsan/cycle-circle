import { normalizeSubscriptionStatus } from '@vesta/shared/server/adapters/bdapps'

/** Map a BDApps subscription-notify status to a registration change, or null to ignore. */
export function mapNotifyStatus(status: unknown): 'registered' | 'unregistered' | null {
  const s = normalizeSubscriptionStatus(status)
  if (s === 'REGISTERED') return 'registered'
  if (s === 'UNREGISTERED') return 'unregistered'
  return null
}
