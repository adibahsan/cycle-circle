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
    const nav = page.getByRole('navigation', { name: /Mobile navigation/ })
    await expect(nav).toBeVisible()
    await expect(nav.getByRole('link').or(nav.getByRole('button'))).toHaveCount(5)
    await expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    await expect(nav.getByRole('link', { name: 'Calendar' })).not.toHaveAttribute('aria-current', 'page')

    const moreBtn = nav.getByRole('button', { name: 'More' })
    await expect(moreBtn).toBeVisible()
    await moreBtn.click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    for (const [name, href] of [['Learn', '/content'], ['Profiles', '/profiles'], ['Subscription', '/subscription'], ['Feedback', '/feedback'], ['Settings', '/settings']]) {
      await expect(sheet.getByRole('link', { name })).toHaveAttribute('href', href)
    }
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    await expect(moreBtn).toBeFocused()

    await moreBtn.click()
    await sheet.getByRole('link', { name: 'Settings' }).click()
    await expect(page).toHaveURL(/\/settings/)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})
