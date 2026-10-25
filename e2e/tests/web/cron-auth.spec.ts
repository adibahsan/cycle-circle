import { test, expect } from '../../support/fixtures'
import { URLS } from '../../support/slot.ts'

const CRON_ROUTES = [
  '/api/cron/daily-reminders',
  '/api/cron/nightly-maintenance',
  '/api/cron/caas-check',
] as const

test.describe('cron: secret auth', () => {
  for (const path of CRON_ROUTES) {
    test(`${path} rejects calls without the cron secret`, async ({ request }) => {
      const url = `${URLS.web}${path}`
      const bare = await request.post(url)
      expect(bare.status()).toBe(401)
      expect(await bare.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } })

      const wrong = await request.post(url, {
        headers: { authorization: 'Bearer not-the-cron-secret' },
      })
      expect(wrong.status()).toBe(401)
      expect(await wrong.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } })
    })
  }
})
