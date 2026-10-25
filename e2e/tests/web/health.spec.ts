import { test, expect } from '../../support/fixtures'

/**
 * Happy-path health probes (serial `cron` project). BDApps up/down scripting lives in
 * `bdapps-health.spec.ts` (same project; `{ any: true }` failure queue).
 *
 * E2E runs without Redis (`REDIS_URL=''` in support/slot.ts): redis reports `skipped`,
 * worker reports `ok: false` / `redis not configured`.
 */
test.describe('health endpoints', () => {
  test('db, mailpit and bdapps report up; redis is skipped without Redis', async ({ page }) => {
    const db = await page.request.get('/api/health/db')
    expect(db.status()).toBe(200)
    expect(await db.json()).toMatchObject({ status: 'ok' })

    const mailpit = await page.request.get('/api/health/mailpit')
    expect(mailpit.status()).toBe(200)
    expect(await mailpit.json()).toMatchObject({ status: 'ok' })

    const bdapps = await page.request.get('/api/health/bdapps')
    expect(bdapps.status()).toBe(200)
    expect(await bdapps.json()).toMatchObject({ status: 'ok' })

    const redis = await page.request.get('/api/health/redis')
    expect(redis.status()).toBe(200)
    expect(await redis.json()).toMatchObject({ status: 'skipped', mode: 'in-memory' })

    const worker = await page.request.get('/api/health/worker')
    expect(worker.status()).toBe(200)
    expect(await worker.json()).toMatchObject({ ok: false, error: 'redis not configured' })
  })
})
