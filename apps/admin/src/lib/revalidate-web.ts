import { logger } from '@vesta/shared/server/log'

// Fire-and-forget bust of the WEB app's Next cache tags (admin & web are
// separate processes with separate caches). No-op if env is unset.
// Returns false when the refresh was attempted and failed, so callers can surface it.
export async function revalidateWebTags(tags: string[]): Promise<boolean> {
  const base = process.env.APP_URL
  const secret = process.env.CRON_SECRET
  if (!base || !secret || tags.length === 0) return true
  try {
    const res = await fetch(`${base}/api/internal/revalidate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
      cache: 'no-store',
    })
    if (!res.ok) {
      logger.error('revalidate-web.failed', new Error(`HTTP ${res.status}`), { tags })
      return false
    }
    return true
  } catch (err) {
    logger.error('revalidate-web.failed', err, { tags })
    return false
  }
}
