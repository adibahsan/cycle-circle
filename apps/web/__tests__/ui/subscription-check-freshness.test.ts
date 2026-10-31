import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '../../../..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')
const body = (src: string, name: string) =>
  src.slice(src.indexOf(`export const ${name} =`)).split('\nexport const ')[0]

// The scheduled check runs in apps/web, so it cannot revalidate the admin's cache tags (same
// situation as the SMS cron, issue #200). Every admin view of a run's result must therefore expire
// on its own within a minute. The run history and the strip are not cached at all.
describe('admin views are at most a minute stale after a scheduled subscription check', () => {
  it('the Subscriptions table (last confirmed) and user detail use KPI_CACHE_TTL', () => {
    expect(body(read('apps/admin/src/app/queries/subscription-queries.ts'), 'getSubscriptions')).toContain('revalidate: KPI_CACHE_TTL')
    expect(body(read('apps/admin/src/app/queries/user-queries.ts'), 'getUserDetail')).toContain('revalidate: KPI_CACHE_TTL')
  })

  it('the run history, latest run and run detail are read live, never cached', () => {
    const src = read('apps/admin/src/app/queries/system-queries.ts')
    expect(src).not.toContain('unstable_cache')
  })
})
