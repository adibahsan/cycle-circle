import { logger } from '@vesta/shared/server/log'

// Fire-and-forget bust of the WEB app's Next cache tags (admin & web are
// separate processes with separate caches). No-op if env is unset.
export async function revalidateWebTags(tags: string[]): Promise<void> {
  const base = process.env.APP_URL
  const secret = process.env.CRON_SECRET
  if (!base || !secret || tags.length === 0) return
  try {
    await fetch(`${base}/api/internal/revalidate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
      cache: 'no-store',
    })
  } catch (err) {
    logger.error('revalidate-web.failed', err, { tags })
  }
}
