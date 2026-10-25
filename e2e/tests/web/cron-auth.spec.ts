import { test, expect } from '../../support/fixtures'
import { URLS } from '../../support/slot.ts'

const CRON_ROUTES = [
  '/api/cron/daily-reminders',
  '/api/cron/nightly-maintenance',
  '/api/cron/caas-check',
] as const

test.describe('cron: secret auth', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name.endsWith('-phone'), 'cron auth is viewport-independent; desktop only')
  })

  for (const path of CRON_ROUTES) {
    test(`${path} rejects POST without a valid cron secret`, async ({ request }) => {
      const url = `${URLS.web}${path}`

      const bare = await request.post(url)
      expect(bare.status()).toBe(401)
      expect(await bare.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } })

      const wrong = await request.post(url, {
        headers: { authorization: 'Bearer not-the-cron-secret' },
      })
      expect(wrong.status()).toBe(401)
      expect(await wrong.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } })

      const emptyToken = await request.post(url, {
        headers: { authorization: 'Bearer ' },
      })
      expect(emptyToken.status()).toBe(401)
      expect(await emptyToken.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } })

      const basic = await request.post(url, {
        headers: { authorization: `Basic ${Buffer.from('cron:secret').toString('base64')}` },
      })
      expect(basic.status()).toBe(401)
      expect(await basic.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } })
    })

    test(`${path} rejects GET without a valid cron secret`, async ({ request }) => {
      const url = `${URLS.web}${path}`
      const bare = await request.get(url)
      expect(bare.status()).toBe(401)
      expect(await bare.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } })

      const wrong = await request.get(url, {
        headers: { authorization: 'Bearer not-the-cron-secret' },
      })
      expect(wrong.status()).toBe(401)
      expect(await wrong.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } })
    })
  }
})
