/**
 * W60 — phone shell: bottom nav, More sheet, no sideways scroll (#133).
 * Desktop project skips — these assertions are phone-chrome only.
 */
import { test, expect } from '../../support/fixtures.ts'
import { ensureUserProfile } from '../../support/db.ts'
import { suppressAutoPrompts } from '../../support/prompts.ts'

const ROUTES = [
  '/dashboard',
  '/calendar',
  '/symptoms',
  '/insights',
  '/content',
  '/profiles',
  '/settings',
  '/subscription',
  '/feedback',
] as const

test.describe('phone shell (W60)', () => {
  test.beforeEach(({}, testInfo) => {
    // Bottom nav / More sheet only exist at phone width — desktop uses the sidebar.
    test.skip(!testInfo.project.name.endsWith('-phone'), 'phone chrome only (bottom nav); desktop uses sidebar (W59)')
  })

  test('bottom nav, More sheet destinations, no sideways scroll on main routes', async ({ newUser }) => {
    const { page, phone } = await newUser()
    await ensureUserProfile(phone, { name: 'Phone Shell User' })
    await suppressAutoPrompts(page)

    for (const route of ROUTES) {
      await page.goto(route)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
      expect(overflow, `${route} sideways scroll`).toBe(false)
    }

    await page.goto('/dashboard')
    const nav = page.locator('nav[data-bottom-nav]')
    await expect(nav).toBeVisible()
    await expect(nav.locator('a, button')).toHaveCount(5)
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1)

    const moreBtn = nav.locator('button[aria-haspopup="dialog"]').first()
    await expect(moreBtn).toBeVisible()
    await moreBtn.click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    for (const href of ['/content', '/profiles', '/subscription', '/feedback', '/settings']) {
      await expect(sheet.locator(`a[href="${href}"]`)).toBeVisible()
    }
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    await expect(moreBtn).toBeFocused()

    await moreBtn.click()
    await sheet.locator('a[href="/settings"]').click()
    await expect(page).toHaveURL(/\/settings/)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})
