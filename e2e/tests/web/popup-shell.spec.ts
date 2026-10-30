/**
 * W61 — pop-up shell contract on real dialogs: dialog semantics, ESC, focus return, inert background (#133).
 */
import { test, expect } from '../../support/fixtures.ts'
import { ensureUserProfile } from '../../support/db.ts'
import { suppressAutoPrompts } from '../../support/prompts.ts'
import { openDialog } from '../../support/dialogs.ts'

test.describe('pop-up shell contract (W61)', () => {
  test('period-log and logout dialogs: role=dialog, ESC closes, focus returns, background inert', async ({ newUser }) => {
    const { page, phone } = await newUser()
    await ensureUserProfile(phone, { name: 'Popup Shell User' })
    await suppressAutoPrompts(page)

    await page.goto('/dashboard')
    const logPeriod = page.getByRole('button', { name: /Log Period|পিরিয়ড লগ করুন/i }).first()
    const periodDialog = await openDialog(logPeriod)
    await expect(periodDialog).toHaveAttribute('aria-modal', 'true')
    // eslint-disable-next-line playwright/no-raw-locators -- inert siblings of the dialog are the assertion, no role
    expect(await page.locator('body > [inert]').count()).toBeGreaterThan(0)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(logPeriod).toBeFocused()
    // eslint-disable-next-line playwright/no-raw-locators -- inert siblings of the dialog are the assertion, no role
    expect(await page.locator('body > [inert]').count()).toBe(0)

    await page.goto('/settings')
    const logout = page.getByRole('button', { name: /Log out|Log Out|লগ আউট/i }).first()
    const logoutDialog = await openDialog(logout)
    await expect(logoutDialog).toHaveAttribute('aria-modal', 'true')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(logout).toBeFocused()
  })

  test('phone More sheet: ESC restores focus to trigger', async ({ newUser }, testInfo) => {
    // More sheet is phone bottom-nav only — desktop has no this dialog.
    test.skip(!testInfo.project.name.endsWith('-phone'), 'More sheet is phone bottom-nav only')
    const { page, phone } = await newUser()
    await ensureUserProfile(phone, { name: 'More Sheet User' })
    await suppressAutoPrompts(page)
    await page.goto('/dashboard')
    // eslint-disable-next-line playwright/no-raw-locators -- bottom nav is an unnamed <nav>; found by its data attribute
    const more = page.locator('nav[data-bottom-nav]').getByRole('button', { name: 'More' })
    await openDialog(more)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(more).toBeFocused()
  })
})
