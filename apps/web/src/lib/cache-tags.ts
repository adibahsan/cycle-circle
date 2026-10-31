/**
 * Canonical Next.js `unstable_cache` tags for the web app.
 *
 * Single source of truth so cached reads (queries/*.ts) and the mutations that
 * invalidate them (actions/*.ts, route handlers) never drift or misspell a tag.
 * Mirror of `apps/admin/src/lib/admin-cache-tags.ts`.
 *
 * Keep this file pure — no `next/cache` import — so it can be used from both
 * server queries and client-reachable modules without pulling in server-only code.
 */

export const WEB_CACHE_TTL = 300

export const cacheTags = {
  /** A user's cached record (getCurrentUser). Keyed by userId. */
  user: (id: string) => `user:${id}`,
  /** A user's profile list (getProfiles). Keyed by userId. */
  profiles: (userId: string) => `profiles:${userId}`,
  /** Tracking-derived data for a profile (dashboard, calendar, logs, insights, prediction). Keyed by profileId. */
  tracking: (profileId: string) => `tracking:${profileId}`,
  /** Symptom logs for a profile. Keyed by profileId. */
  symptoms: (profileId: string) => `symptoms:${profileId}`,
  /** Published articles (global). */
  articles: 'articles',
  /** The Pro price in effect (global). Admin busts it when it sets a price. */
  proPrice: 'pro-price',
} as const

/**
 * Whether a tag is one this app is willing to revalidate via the cross-app
 * `/api/internal/revalidate` endpoint. Prevents arbitrary tag busting.
 */
export function isAllowedRevalidationTag(tag: string): boolean {
  return tag === cacheTags.articles || tag === cacheTags.proPrice || /^(user|profiles|tracking|symptoms):.+/.test(tag)
}
