/**
 * Subscription tier for display/gating. Single source of truth so badges don't
 * drift on case-sensitivity or forget that "Free" is an email-only concept.
 *
 * Rule: the tier follows `subscriptionStatus`. A BDApps-verified phone login
 * (REGISTERED) sets PRO; email-only users stay FREE (24h trial) until they verify
 * a phone. LAPSED (billing failure / admin revoke) is a distinct state — never
 * collapse it into "Free". See ADR 0002.
 */

export type Tier = 'PRO' | 'LAPSED' | 'FREE'

type TierUser = {
  authMethod?: string | null
  subscriptionStatus?: string | null
}

export function getSubscriptionTier(u: TierUser): Tier {
  const status = (u.subscriptionStatus ?? 'FREE').toUpperCase()
  if (status === 'PRO') return 'PRO'
  if (status === 'LAPSED') return 'LAPSED'
  return 'FREE'
}

export function isPro(u: TierUser): boolean {
  return getSubscriptionTier(u) === 'PRO'
}
