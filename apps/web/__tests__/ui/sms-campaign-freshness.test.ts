import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '../../../..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')

// The cron sends from apps/web, so it cannot revalidate the admin's cache tags. The campaign
// views must therefore expire on their own within a minute (issue #200).
describe('campaign views are at most a minute stale after a cron send', () => {
  it('KPI_CACHE_TTL is 60 seconds or less', () => {
    const ttl = Number(/KPI_CACHE_TTL = (\d+)/.exec(read('apps/admin/src/lib/admin-cache-tags.ts'))?.[1])
    expect(ttl).toBeLessThanOrEqual(60)
  })

  it('the campaign list and detail queries use KPI_CACHE_TTL', () => {
    const src = read('apps/admin/src/app/queries/sms-queries.ts')
    for (const name of ['getSmsCampaigns', 'getSmsCampaign']) {
      const body = src.slice(src.indexOf(`export const ${name} =`)).split('\nexport const ')[0]
      expect(body, name).toContain('revalidate: KPI_CACHE_TTL')
    }
  })
})
