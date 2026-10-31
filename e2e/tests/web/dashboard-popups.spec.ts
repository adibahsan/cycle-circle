/**
 * W39 — dashboard pop-ups and celebration toast (#133 closes the #123 look-only gap).
 */
import { test, expect } from '../../support/fixtures.ts'
import { ensureUserProfile, setPeriodLogs } from '../../support/db.ts'
import { suppressAutoPrompts } from '../../support/prompts.ts'
import { openDialog } from '../../support/dialogs.ts'

test.describe('dashboard pop-ups and celebration (W39)', () => {
  test('period-log and quick-symptom dialogs open from the dashboard', async ({ newUser, days }) => {
    const { page, phone } = await newUser()
    const profile = await ensureUserProfile(phone, { name: 'Dash Popups' })
    await setPeriodLogs(profile.id, [
      { startDate: days.dateOf(days.daysAgo(10)), endDate: days.dateOf(days.daysAgo(6)) },
    ])
    await suppressAutoPrompts(page)
    await page.goto('/dashboard')

    const logPeriod = page.getByRole('button', { name: /Log Period/i }).first()
    const periodDialog = await openDialog(logPeriod)
    await expect(periodDialog).toHaveAttribute('aria-modal', 'true')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    const quick = page.getByRole('button', { name: /Log Symptoms/i }).first()
    await openDialog(quick)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('saving a period shows a celebration toast (polite live region, no focus steal)', async ({ newUser, days }) => {
    const { page, phone } = await newUser()
    await ensureUserProfile(phone, { name: 'Celebrate User' })
    await suppressAutoPrompts(page)
    await page.goto('/dashboard')

    // eslint-disable-next-line playwright/no-raw-locators -- toast region has no accessible name; its role is the assertion
    const region = page.locator('[data-toast-region]')
    await expect(region).toBeAttached()
    await expect(region).toHaveAttribute('role', 'status')
    await expect(region).toHaveAttribute('aria-live', 'polite')

    const dialog = await openDialog(page.getByRole('button', { name: /Log Period/i }).first())
    await page.getByLabel('Start Date').fill(days.daysAgo(4))
    await page.getByLabel('End Date').fill(days.today)
    await page.getByRole('button', { name: 'Save Period' }).click()
    await expect(dialog).toHaveCount(0, { timeout: 15_000 })

    await expect(region.getByText(/Logged!|cycle just got smarter|লগ হয়েছে/i).first()).toBeVisible({
      timeout: 10_000,
    })
    expect(await region.evaluate((el) => el.contains(document.activeElement))).toBe(false)
  })
})
