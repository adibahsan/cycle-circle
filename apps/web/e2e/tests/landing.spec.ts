import { test, expect, type Page } from '@playwright/test'
import { PHONE_375, DESKTOP, expectNoHorizontalOverflow, settle } from '../guards/helpers'

// The landing page is for signed-out visitors: drop the seeded session.
test.use({ storageState: { cookies: [], origins: [] } })

const BELOW_HERO = ['#features-heading', '#phases-heading', '#how-heading', '#charges-heading', '#proof-heading']

/** Effective opacity (own x ancestors). Playwright's toBeVisible ignores opacity, so check it here. */
async function effectiveOpacity(page: Page, selector: string) {
  return page.locator(selector).evaluate((el) => {
    let o = 1
    for (let n: Element | null = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity)
    return o
  })
}

async function expectBelowHeroOpaque(page: Page) {
  for (const sel of BELOW_HERO) expect(await effectiveOpacity(page, sel), sel).toBe(1)
  await expect(page.locator('#features-heading')).toBeVisible()
  await expect(page.getByRole('link', { name: /.+/ }).last()).toBeVisible()
}

test.describe('landing content visible by default', () => {
  test('below-hero content is in the server HTML and opaque with JS disabled', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: DESKTOP })
    const page = await ctx.newPage()
    await page.goto('/welcome')
    await expectBelowHeroOpaque(page)
    await ctx.close()
  })

  test('full-page content is opaque without scrolling', async ({ page }) => {
    await page.goto('/welcome')
    await settle(page)
    await expectBelowHeroOpaque(page)
  })

  test('reduced motion: everything is static', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/welcome')
    await settle(page)
    await expectBelowHeroOpaque(page)
    const running = await page.locator('.reveal-on-scroll').evaluateAll(
      (els) => els.filter((e) => getComputedStyle(e).animationName !== 'none').length,
    )
    expect(running).toBe(0)
  })
})

async function containerBoxes(page: Page) {
  return page.locator('main section:not(:first-of-type) > div, main footer > div').evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect()
      return { left: Math.round(r.left), width: Math.round(r.width) }
    }),
  )
}

async function sectionGaps(page: Page) {
  return page.locator('main section:not(:first-of-type)').evaluateAll((els) =>
    els.map((e) => {
      const s = getComputedStyle(e)
      return `${s.paddingTop}/${s.paddingBottom}`
    }),
  )
}

for (const [name, viewport] of [['desktop', DESKTOP], ['375px', PHONE_375]] as const) {
  test.describe(`landing layout at ${name}`, () => {
    test.use({ viewport })

    test('no horizontal overflow', async ({ page }) => {
      await page.goto('/welcome')
      await settle(page)
      await expectNoHorizontalOverflow(page)
    })

    test('sections share one container left edge and width', async ({ page }) => {
      await page.goto('/welcome')
      await settle(page)
      const boxes = await containerBoxes(page)
      expect(boxes.length).toBeGreaterThan(3)
      expect(new Set(boxes.map((b) => b.left)).size).toBe(1)
      expect(new Set(boxes.map((b) => b.width)).size).toBe(1)
    })

    test('sections share one vertical spacing', async ({ page }) => {
      await page.goto('/welcome')
      await settle(page)
      expect(new Set(await sectionGaps(page)).size).toBe(1)
    })
  })
}
