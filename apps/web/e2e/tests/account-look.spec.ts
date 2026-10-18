import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { gotoQuiet, DESKTOP, PHONE_375, expectNoHorizontalOverflow } from '../guards/helpers'

// #81 (spec #66): settings, profiles and subscription in the new look.
const ROUTES = ['/settings', '/profiles', '/subscription'] as const
const SHOTS = path.resolve(__dirname, '../../../../review/screenshots/e2e/account-look')

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => {
    document.documentElement.classList.toggle('dark', t === 'dark')
    document.documentElement.style.colorScheme = t
  }, theme)
}

/** Heading levels inside main never skip a level (h1 → h3). */
async function headingLevels(page: Page) {
  return page
    .locator('main')
    .evaluate((m) => Array.from(m.querySelectorAll('h1, h2, h3, h4')).filter((h) => (h as HTMLElement).offsetParent !== null).map((h) => Number(h.tagName[1])))
}

for (const [vpName, viewport] of [['desktop', DESKTOP], ['phone', PHONE_375]] as const) {
  test.describe(`account pages new look (${vpName})`, () => {
    test.use({ viewport })

    for (const route of ROUTES) {
      test(`${route}: panels, heading order, no overflow, light + dark screenshots`, async ({ page }) => {
        await gotoQuiet(page, route)
        await expect(page.locator('main h1')).toHaveCount(1)
        expect(await page.locator('main .rounded-panel:visible').count(), `${route} panels`).toBeGreaterThan(0)

        const levels = await headingLevels(page)
        for (let i = 1; i < levels.length; i++) {
          expect(levels[i] - levels[i - 1], `${route} headings ${levels.join(',')}`).toBeLessThanOrEqual(1)
        }
        await expectNoHorizontalOverflow(page)

        const infinite = await page.evaluate(() =>
          document
            .getAnimations()
            .filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity).length,
        )
        expect(infinite, `${route} infinite animations`).toBe(0)

        const slug = route.slice(1)
        for (const theme of ['light', 'dark'] as const) {
          await setTheme(page, theme)
          await page.screenshot({ path: path.join(SHOTS, `${slug}-${theme}-${vpName}.png`), fullPage: true })
        }
      })
    }

    test('settings section headers are the shared h2 with a decorative tinted icon', async ({ page }) => {
      await gotoQuiet(page, '/settings')
      const h2s = page.locator('main h2')
      // Wait for the client-rendered sections before counting (count() does not retry).
      await expect(h2s.nth(4)).toBeVisible()
      for (const h of await h2s.all()) {
        await expect(h.locator('[aria-hidden="true"]').first()).toBeAttached()
        expect((await h.innerText()).trim()).not.toBe('')
      }
    })

    test('profiles add form: every control is at least 44px and headings do not skip', async ({ page }) => {
      await gotoQuiet(page, '/profiles')
      const add = page.locator('main').getByRole('button', { name: /add profile|প্রোফাইল যোগ/i }).first()
      test.skip(!(await add.isVisible().catch(() => false)), 'persona is at the profile limit')
      await add.click()
      await expect(page.locator('main h2').first()).toBeVisible()
      const levels = await headingLevels(page)
      for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1)
      // Layout height (ignores in-flight entrance transforms); tolerate sub-pixel rounding of 2.75rem.
      for (const c of await page.locator('main button:visible').all()) {
        const h = await c.evaluate((el) => parseFloat(getComputedStyle(el).height))
        expect(h, `${await c.evaluate((el) => el.outerHTML.slice(0, 90))} tap height`).toBeGreaterThanOrEqual(43.5)
      }
    })
  })
}
