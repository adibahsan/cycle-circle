/**
 * Handbook chapter "Symptoms & Check-in" (docs/handbook/chapters/symptoms-and-checkin.md), ticket #242.
 * Seeded personas are read-only: these shots look and select but never save.
 */
import { test, expect } from '../../../support/fixtures.ts'
import { statePath } from '../../../support/personas.ts'
import { setupProfile } from '../../../support/profiles.ts'
import { suppressAutoPrompts } from '../../../support/prompts.ts'
import { shot } from '../../support/shot.ts'

test.describe('Symptoms and check-in', () => {
  test.describe('Rina (streaker, logged today)', () => {
    test.use({ storageState: statePath('streaker') })

    test('logging symptoms and back-dating from the calendar', async ({ page, days }) => {
      await suppressAutoPrompts(page)
      await page.goto('/symptoms')
      await expect(page.getByRole('heading', { name: 'Symptoms' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Cramps' })).toHaveAttribute('aria-pressed', 'true')
      await shot(page, 'sc-symptoms')

      await page.getByRole('tab', { name: /Mood/ }).click()
      await page.getByRole('button', { name: 'Calm' }).click()
      await expect(page.getByRole('button', { name: /Save 1 changes/ })).toBeVisible()
      await shot(page, 'sc-symptoms', { suffix: 'unsaved' })

      // Back-dated: open a day from the past (4 days ago, which has one symptom logged).
      await page.goto(`/symptoms?date=${days.daysAgo(4)}`)
      await page.getByRole('tab', { name: /Mood/ }).click()
      await expect(page.getByRole('button', { name: 'Mood Swings' })).toHaveAttribute('aria-pressed', 'true')
      await shot(page, 'sc-backdate')

      // Documented rule: the page does not stop a User opening a day in the future.
      await page.goto(`/symptoms?date=${days.daysAgo(-5)}`)
      await expect(page.getByRole('button', { name: 'Cramps' })).toHaveAttribute('aria-pressed', 'false')
    })
  })

  test.describe('Nasrin (stale, nothing logged today)', () => {
    test.use({ storageState: statePath('stale') })

    test('check-in pop-up, quick symptom pop-up and backfill from the grid', async ({ page }) => {
      await suppressAutoPrompts(page)
      await page.goto('/dashboard')
      await page.getByRole('button', { name: 'Check in', exact: true }).click()
      const checkIn = page.getByRole('dialog').filter({ hasText: 'How are you feeling today?' })
      await expect(checkIn).toBeVisible()
      await shot(page, 'sc-checkin')
      await checkIn.getByRole('button', { name: 'Cramps' }).click()
      await checkIn.getByRole('button', { name: 'Fatigue' }).click()
      await expect(checkIn.getByRole('button', { name: /^Save \(2\)/ })).toBeVisible()
      await shot(page, 'sc-checkin', { suffix: 'selected' })

      await checkIn.getByRole('button', { name: 'More', exact: true }).click()
      const quick = page.getByRole('dialog').filter({ hasText: 'Every signal you log makes Cycle Circle smarter for you' })
      await expect(quick).toBeVisible()
      await shot(page, 'sc-quick-symptom')
      await quick.getByRole('tab', { name: /Mood/ }).click()
      await quick.getByRole('button', { name: 'Calm' }).click()
      await shot(page, 'sc-quick-symptom', { suffix: 'selected' })
    })

    test('backfill a missed day from the check-in grid', async ({ page }) => {
      await suppressAutoPrompts(page)
      await page.goto('/dashboard')
      const missed = page.getByRole('button', { name: /: Not logged$/ }).last()
      await expect(missed).toBeVisible()
      await missed.scrollIntoViewIfNeeded()
      await shot(page, 'sc-backdate', { suffix: 'grid' })
      await missed.click()
      await expect(page.getByRole('dialog').filter({ hasText: 'Tap how you\'re feeling today' })).toBeVisible()
      await shot(page, 'sc-backdate', { suffix: 'grid-pop-up' })
    })
  })

  test('all good today', async ({ newUser }) => {
    const { page } = await newUser()
    await suppressAutoPrompts(page)
    await setupProfile(page, { name: 'Sultana' })
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Check in', exact: true }).click()
    const checkIn = page.getByRole('dialog').filter({ hasText: 'How are you feeling today?' })
    await expect(checkIn).toBeVisible()
    await checkIn.getByRole('button', { name: 'All good today', exact: true }).click()
    await expect(page.getByText("You've checked in today")).toBeVisible()
    await expect(page.getByText('1-day streak!')).toBeVisible()
    await expect(page.getByText('1-day streak!')).toBeHidden({ timeout: 15_000 }) // let the streak toast go
    await shot(page, 'sc-all-good', { suffix: 'dashboard' })

    await page.goto('/symptoms')
    await expect(page.getByRole('button', { name: 'No issues logged for this day' }).first()).toBeVisible()
    await shot(page, 'sc-all-good')
  })
})
