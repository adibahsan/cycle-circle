/**
 * W63 — error and not-found states (#133).
 */
import type { Page } from '@playwright/test'
import { test, expect } from '../../support/fixtures.ts'
import { ensureUserProfile } from '../../support/db.ts'
import { suppressAutoPrompts } from '../../support/prompts.ts'

/** Abort Next.js server-action POSTs so a symptom save never reaches the server. */
async function failServerActions(page: Page) {
  await page.route('**/*', async (route) => {
    const req = route.request()
    if (req.method() === 'POST' && req.headers()['next-action']) return route.abort('failed')
    return route.fallback()
  })
}

test.describe('error and not-found (W63)', () => {
  test('unknown route shows a not-found page with one h1 and a way home', async ({ newUser }) => {
    const { page, phone } = await newUser()
    await ensureUserProfile(phone, { name: 'NotFound User' })
    await suppressAutoPrompts(page)
    await page.goto('/this-page-does-not-exist')
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.getByRole('link', { name: /dashboard|ড্যাশবোর্ড/i }).first()).toBeVisible()
  })

  test('a failed symptom save shows a visible error and keeps the selection', async ({ newUser }) => {
    const { page, phone } = await newUser()
    await ensureUserProfile(phone, { name: 'Save Error User' })
    await suppressAutoPrompts(page)
    await failServerActions(page)

    await page.goto('/symptoms')
    const group = page.getByRole('group', { name: /Physical|শারীরিক/i })
    const chip = group.getByRole('button', { pressed: false }).first()
    const name = await chip.getAttribute('aria-label')
    await chip.click()
    await page.getByRole('button', { name: /^Save \d+ changes$|^.*?পরিবর্তন/i }).filter({ visible: true }).first().click()
    await expect(page.getByRole('status').filter({ hasText: /couldn.t save|save|সমস্যা|ব্যর্থ|error/i })).toBeVisible({
      timeout: 10_000,
    })
    if (name) {
      await expect(group.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true')
    } else {
      await expect(chip).toHaveAttribute('aria-pressed', 'true')
    }
  })
})
