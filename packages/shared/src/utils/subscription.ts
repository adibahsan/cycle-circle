/**
 * Subscription tier for display/gating. Single source of truth so badges don't
 * drift on case-sensitivity or forget that "Free" is an email-only concept.
 *
 * Rule: phone (OTP) users are PRO by design (the auth flow grants it on every
 * login). The FREE tier only applies to email/magic-link trial users. A phone
 * user with a stale/legacy FREE row is therefore treated as PRO. LAPSED (billing
 * failure / admin revoke) is a distinct state — never collapse it into "Free".
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
  // FREE in the DB: only EMAIL users are genuinely Free (on trial). Any non-EMAIL
  // (phone/OTP) user is Pro by design.
  return u.authMethod === 'EMAIL' ? 'FREE' : 'PRO'
}

export function isPro(u: TierUser): boolean {
  return getSubscriptionTier(u) === 'PRO'
}
