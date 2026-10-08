import { test, expect } from '@playwright/test'
import { statePath } from '../support/auth'
import { gotoQuiet, expectNoHorizontalOverflow, expectWithinViewport, PHONE_375, DESKTOP } from '../guards/helpers'

/** No half-width card may sit alone in its row (a lone half-width card beside empty space). */
async function expectNoHalfWidthPair(page: import('@playwright/test').Page, containerSel: string) {
  const { parentW, rects } = await page.locator(containerSel).evaluate((el) => ({
    parentW: Math.round(el.getBoundingClientRect().width),
    rects: Array.from(el.children)
      .map((c) => c.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({ w: Math.round(r.width), top: Math.round(r.top) })),
  }))
  const rows = new Map<number, number[]>()
  for (const r of rects) {
    const key = [...rows.keys()].find((k) => Math.abs(k - r.top) < 8) ?? r.top
    rows.set(key, [...(rows.get(key) ?? []), r.w])
  }
  // The grid also holds the animated add-profile region; only assert on rows that hold cards.
  for (const [, ws] of rows) {
    if (ws.length === 1) expect(ws[0], `lone card ${ws[0]}/${parentW} ${JSON.stringify(rects)}`).toBeGreaterThanOrEqual(parentW * 0.9)
  }
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

  test('insights with partial data collapses empty charts into one note', async ({ page }) => {
    await gotoQuiet(page, '/insights')
    await expect(page.getByText(/not enough data yet/i)).toHaveCount(1)
    await expect(page.getByTestId('insights-missing-note')).toHaveCount(1)
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
