/**
 * W61 — pop-up shell contract on real dialogs: dialog semantics, ESC, focus return, inert background (#133).
 */
import type { Locator, Page } from '@playwright/test'
import { test, expect } from '../../support/fixtures.ts'
import { ensureUserProfile } from '../../support/db.ts'
import { suppressAutoPrompts } from '../../support/prompts.ts'

async function openDialog(page: Page, trigger: Locator) {
  await expect(trigger).toBeVisible({ timeout: 15_000 })
  await trigger.click()
  const dialog = page.getByRole('dialog').first()
  await expect(dialog).toBeVisible()
  return dialog
}

test.describe('pop-up shell contract (W61)', () => {
  test('period-log and logout dialogs: role=dialog, ESC closes, focus returns, background inert', async ({ newUser }) => {
    const { page, phone } = await newUser()
    await ensureUserProfile(phone, { name: 'Popup Shell User' })
    await suppressAutoPrompts(page)

    await page.goto('/dashboard')
    const logPeriod = page.getByRole('button', { name: /Log Period|পিরিয়ড লগ করুন/i }).first()
    const periodDialog = await openDialog(page, logPeriod)
    await expect(periodDialog).toHaveAttribute('aria-modal', 'true')
    expect(await page.locator('body > [inert]').count()).toBeGreaterThan(0)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(logPeriod).toBeFocused()
    expect(await page.locator('body > [inert]').count()).toBe(0)

    await page.goto('/settings')
    const logout = page.getByRole('button', { name: /Log out|Log Out|লগ আউট/i }).first()
    const logoutDialog = await openDialog(page, logout)
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
    const more = page.locator('nav[data-bottom-nav] button[aria-haspopup="dialog"]').first()
    await openDialog(page, more)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(more).toBeFocused()
  })
})
