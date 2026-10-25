/**
 * W59 — signed-in shell: sidebar/header, skip link, one h1, no sideways scroll (#133).
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

test.describe('signed-in shell (W59)', () => {
  test('every main route has exactly one h1; desktop has sidebar + skip link', async ({ newUser }, testInfo) => {
    const { page, phone } = await newUser()
    await ensureUserProfile(phone, { name: 'Shell User' })
    await suppressAutoPrompts(page)

    for (const route of ROUTES) {
      await page.goto(route)
      await expect(page.locator('h1'), `${route} h1 count`).toHaveCount(1)

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement
        return doc.scrollWidth > doc.clientWidth + 1
      })
      expect(overflow, `${route} sideways scroll`).toBe(false)
    }

    // Desktop chrome: skip link + sidebar. Phone uses bottom nav (W60) instead.
    if (testInfo.project.name.endsWith('-phone')) {
      // Phone viewport: skip link still exists; sidebar is hidden.
      await page.goto('/dashboard')
      await expect(page.getByRole('link', { name: /skip to main content|মূল কনটেন্টে যান/i })).toBeAttached()
      return
    }

    await page.goto('/dashboard')
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: /skip to main content|মূল কনটেন্টে যান/i })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('main')).toBeFocused()

    await expect(page.locator('aside, nav[aria-label], [data-sidebar]').first()).toBeVisible()
  })
})
