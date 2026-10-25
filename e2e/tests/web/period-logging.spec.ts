import { test, expect } from '../../support/fixtures.ts'
import { setupProfile } from '../../support/profiles.ts'
import { suppressAutoPrompts } from '../../support/prompts.ts'

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

    // Reload calendar and verify period appears in recent periods
    await page.goto('/calendar')
    await expect(page.getByText('No period logs yet')).toBeHidden()
    await expect(page.getByRole('listitem', { name: /^Edit period log starting/ })).toBeVisible()
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
    await expect(page.getByText('6 days')).toBeVisible()
    await expect(page.getByText('Heavy')).toBeVisible()
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

    // Set device timezone to Europe/London and freeze clock at 01:30 AM Bangladesh time
    // At 2026-10-26T01:30:00+06:00:
    // - Bangladesh day is 2026-10-26
    // - London day is 2026-10-25 (device day differs)
    const bangladeshTime = new Date('2026-10-26T01:30:00+06:00')
    const bangladeshDay = '2026-10-26'

    const { createThrowawayUser } = await import('../../support/users.ts')
    const { context } = await createThrowawayUser(browser, {
      timezoneId: 'Europe/London',
    }, fakeBdapps)

    const page = await context.newPage()
    await suppressAutoPrompts(page)
    await page.clock.setFixedTime(bangladeshTime)

    await setupProfile(page, { name: 'Tz Test User' })
    await page.goto('/dashboard')

    await page.getByRole('button', { name: 'Log Period' }).click()
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()

    // The bug (#115): form defaults to deviceDayString ('2026-10-25') instead of Bangladesh day ('2026-10-26')
    const startVal = await page.getByLabel('Start Date').inputValue()
    expect(startVal).toBe(bangladeshDay)

    await context.close()
  })
})
