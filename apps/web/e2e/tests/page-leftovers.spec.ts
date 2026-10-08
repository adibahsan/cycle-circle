import { test, expect } from '@playwright/test'
import { statePath } from '../support/auth'
import { gotoQuiet, expectNoHorizontalOverflow, expectWithinViewport, PHONE_375, DESKTOP } from '../guards/helpers'

/** Cards that are direct grid children must not leave a half-width card beside a full-width sibling. */
async function expectNoHalfWidthPair(page: import('@playwright/test').Page, containerSel: string) {
  const widths = await page.locator(containerSel).evaluate((el) =>
    Array.from(el.children)
      .map((c) => c.getBoundingClientRect())
      .filter((r) => r.width > 0)
      .map((r) => ({ w: Math.round(r.width), top: Math.round(r.top) })),
  )
  const parentW = await page.locator(containerSel).evaluate((el) => Math.round(el.getBoundingClientRect().width))
  const half = widths.filter((r) => r.w < parentW * 0.6)
  const full = widths.filter((r) => r.w >= parentW * 0.9)
  expect(half.length > 0 && full.length > 0, `mixed widths ${JSON.stringify(widths)}`).toBe(false)
}

test.describe('desktop', () => {
  test.use({ viewport: DESKTOP })

  test('profiles: cards and add-profile share one grid', async ({ page }) => {
    await gotoQuiet(page, '/profiles')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoHalfWidthPair(page, 'main .lg\\:grid')
  })

  test('feedback: form and history are same-width cards', async ({ page }) => {
    await gotoQuiet(page, '/feedback')
    await expectNoHalfWidthPair(page, 'main .lg\\:grid')
  })

  test.describe('empty account', () => {
    test.use({ storageState: statePath('fresh') })
    test('insights with no data shows one empty state', async ({ page }) => {
      await gotoQuiet(page, '/insights')
      await expect(page.getByTestId('insights-empty')).toHaveCount(1)
      await expect(page.getByText(/not enough data yet/i)).toHaveCount(1)
      await expect(page.locator('.recharts-wrapper')).toHaveCount(0)
    })
  })
})

test.describe('phone 375', () => {
  test.use({ viewport: PHONE_375 })
  for (const route of ['/profiles', '/subscription', '/feedback', '/insights']) {
    test(`${route} has no horizontal overflow`, async ({ page }) => {
      await gotoQuiet(page, route)
      await expectNoHorizontalOverflow(page)
    })
  }

  test('onboarding header controls and step counter are visible', async ({ page }) => {
    // A user with no profile (the personas all have one, which redirects to /dashboard).
    const res = await page.request.post('/api/auth/dev-login', { data: { phone: '01700000778' } })
    expect(res.ok()).toBe(true)
    await gotoQuiet(page, '/onboarding')
    await expectNoHorizontalOverflow(page)
    const counter = page.getByText(/^\s*\d\s*\/\s*\d\s*$/).first()
    await expect(counter).toBeVisible()
    await expectWithinViewport(page, counter)
    await expectWithinViewport(page, page.getByRole('button', { name: /log ?out|লগ/i }).first())
  })
})
