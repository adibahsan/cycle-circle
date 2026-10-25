import { test, expect } from '../../support/fixtures.ts'
import { setupProfile } from '../../support/profiles.ts'
import { suppressAutoPrompts } from '../../support/prompts.ts'

/** `2026-10-22` -> "Oct 22", the dashboard's short date (browser default locale, local calendar day). */
function shortDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(y!, m! - 1, d!))
}

test.describe('Period logging', () => {
  test('log a new period updates dashboard and calendar after reload', async ({ newUser, days }) => {
    const { page } = await newUser()
    await suppressAutoPrompts(page)
    await setupProfile(page, { name: 'Period User' })

    await page.goto('/calendar')
    await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible()

    // Recent periods initially shows the empty state
    await expect(page.getByText('No period logs yet')).toBeVisible()

    // Open the period log modal from the dashboard
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Log Period' }).click()

    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()
    await expect(modal.getByRole('heading', { name: 'Log Period' })).toBeVisible()

    // Fill dates: 4 days ago to today
    await page.getByLabel('Start Date').fill(days.daysAgo(4))
    await page.getByLabel('End Date').fill(days.today)
    await page.getByRole('button', { name: 'Heavy' }).click()

    await page.getByRole('button', { name: 'Save Period' }).click()
    await expect(modal).toBeHidden()

    // Reload calendar and verify the exact saved range, length and flow
    await page.goto('/calendar')
    await expect(page.getByText('No period logs yet')).toBeHidden()
    const entry = page.getByRole('listitem', { name: /^Edit period log starting/ })
    await expect(entry).toHaveCount(1)
    await expect(entry).toContainText(`${shortDate(days.daysAgo(4))}`)
    await expect(entry).toContainText(`${shortDate(days.today)}`)
    await expect(entry).toContainText('5 days')
    await expect(entry).toContainText('Heavy')
  })

  test('a logged period shows on the dashboard last-period card after reload', async ({ newUser, days }) => {
    test.fail(true, 'https://github.com/adibahsan/cycle-circle/issues/154')
    const { page } = await newUser()
    await suppressAutoPrompts(page)
    await setupProfile(page, { name: 'Dashboard Period User' })

    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Log Period' }).click()
    await page.getByLabel('Start Date').fill(days.daysAgo(4))
    await page.getByLabel('End Date').fill(days.today)
    await page.getByRole('button', { name: 'Heavy' }).click()
    await page.getByRole('button', { name: 'Save Period' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    await page.goto('/dashboard')
    const lastPeriod = page.getByTestId('last-period')
    await expect(lastPeriod).toContainText(shortDate(days.daysAgo(4)))
    await expect(lastPeriod).toContainText('Lasted 5 days')
    await expect(lastPeriod).toContainText('Heavy flow')
  })

  test('edit a past period updates calendar', async ({ newUser, days }) => {
    const { page } = await newUser()
    await suppressAutoPrompts(page)
    await setupProfile(page, { name: 'Edit Period User' })

    // Create an initial period log
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Log Period' }).click()
    await page.getByLabel('Start Date').fill(days.daysAgo(10))
    await page.getByLabel('End Date').fill(days.daysAgo(6))
    await page.getByRole('button', { name: 'Medium' }).click()
    await page.getByRole('button', { name: 'Save Period' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    // Open calendar and tap to edit the past period
    await page.goto('/calendar')
    const editBtn = page.getByRole('listitem', { name: /^Edit period log starting/ }).first()
    await expect(editBtn).toBeVisible()
    await editBtn.click()

    const modal = page.getByRole('dialog')
    await expect(modal.getByRole('heading', { name: 'Edit Period Log' })).toBeVisible()

    // Change end date and flow intensity
    await page.getByLabel('End Date').fill(days.daysAgo(5))
    await page.getByRole('button', { name: 'Heavy' }).click()
    await page.getByRole('button', { name: 'Update Log' }).click()
    await expect(modal).toBeHidden()

    // Reload and verify updated log
    await page.reload()
    const entry = page.getByRole('listitem', { name: /^Edit period log starting/ })
    await expect(entry).toHaveCount(1)
    await expect(entry).toContainText(shortDate(days.daysAgo(10)))
    await expect(entry).toContainText(shortDate(days.daysAgo(5)))
    await expect(entry).toContainText('6 days')
    await expect(entry).toContainText('Heavy')
  })

  test('delete a past period updates calendar', async ({ newUser, days }) => {
    test.fail(true, 'https://github.com/adibahsan/cycle-circle/issues/136')
    const { page } = await newUser()
    await suppressAutoPrompts(page)
    await setupProfile(page, { name: 'Delete Period User' })

    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Log Period' }).click()
    await page.getByLabel('Start Date').fill(days.daysAgo(12))
    await page.getByLabel('End Date').fill(days.daysAgo(8))
    await page.getByRole('button', { name: 'Save Period' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    await page.goto('/calendar')
    const editBtn = page.getByRole('listitem', { name: /^Edit period log starting/ }).first()
    await editBtn.click()

    const modal = page.getByRole('dialog')
    await expect(modal.getByRole('heading', { name: 'Edit Period Log' })).toBeVisible()

    // Web UI currently lacks a delete button in PeriodLogModal (#136)
    const deleteBtn = modal.getByRole('button', { name: /delete/i })
    await expect(deleteBtn).toBeVisible()
    await deleteBtn.click()

    await expect(modal).toBeHidden()
    await page.reload()
    await expect(page.getByText('No period logs yet')).toBeVisible()
  })

  test('end date before start date is rejected with a visible error', async ({ newUser, days }) => {
    const { page } = await newUser()
    await suppressAutoPrompts(page)
    await setupProfile(page, { name: 'Validation User' })

    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Log Period' }).click()

    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()

    // Set end date earlier than start date
    await page.getByLabel('Start Date').fill(days.today)
    await page.getByLabel('End Date').fill(days.daysAgo(2))
    await page.getByRole('button', { name: 'Save Period' }).click()

    // Must show a visible error and remain open
    await expect(modal.getByRole('alert')).toBeVisible()
    await expect(modal).toBeVisible()
  })

  test('future date is rejected with a visible error', async ({ newUser, days }) => {
    test.fail(true, 'https://github.com/adibahsan/cycle-circle/issues/139')
    const { page } = await newUser()
    await suppressAutoPrompts(page)
    await setupProfile(page, { name: 'Future User' })

    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Log Period' }).click()

    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()

    // Set future date
    await page.getByLabel('Start Date').fill(days.daysFromNow(2))
    await page.getByLabel('End Date').fill(days.daysFromNow(4))
    await page.getByRole('button', { name: 'Save Period' }).click()

    // Must show a visible error and remain open
    await expect(modal.getByRole('alert')).toBeVisible()
    await expect(modal).toBeVisible()
  })

  test('default log date is the Bangladesh day, not the device day', async ({ browser, fakeBdapps }) => {
    test.fail(true, 'https://github.com/adibahsan/cycle-circle/issues/115')

    // 2026-10-26T01:30 Bangladesh = 2026-10-25T19:30Z: Bangladesh day is the 26th, a London device day is the 25th.
    const bangladeshDay = '2026-10-26'
    const { createThrowawayUser } = await import('../../support/users.ts')
    const { context } = await createThrowawayUser(browser, { timezoneId: 'Europe/London' }, fakeBdapps)
    try {
      const page = await context.newPage()
      await suppressAutoPrompts(page)
      await page.clock.setFixedTime(new Date('2026-10-26T01:30:00+06:00'))
      await setupProfile(page, { name: 'Tz Test User' })
      await page.goto('/dashboard')

      // Preconditions: the device day really differs from the Bangladesh day
      const deviceDay = await page.evaluate(() => {
        const d = new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      })
      expect(deviceDay).toBe('2026-10-25')

      await page.getByRole('button', { name: 'Log Period' }).click()
      const modal = page.getByRole('dialog')
      await expect(modal).toBeVisible()
      await expect(page.getByLabel('Start Date')).toBeVisible()

      // The bug (#115): the form defaults to the device day instead of the Bangladesh day
      await expect(page.getByLabel('Start Date')).toHaveValue(bangladeshDay)
      await expect(page.getByLabel('End Date')).toHaveValue(bangladeshDay)

      // ...and the calendar marks the Bangladesh day as today
      await page.keyboard.press('Escape')
      await page.goto('/calendar')
      await expect(page.locator('button[aria-current="date"]')).toHaveAttribute('data-date', bangladeshDay)
    } finally {
      await context.close()
    }
  })
})
