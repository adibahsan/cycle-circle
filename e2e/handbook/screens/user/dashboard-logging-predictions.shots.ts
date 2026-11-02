/**
 * Handbook chapters "Dashboard", "Logging & Calendar" and "Predictions"
 * (docs/handbook/chapters/{dashboard,logging-and-calendar,predictions}.md), ticket #241.
 * Anchors and file names come from docs/handbook/OUTLINE.md; `shot()` refuses anything else.
 * Seeded personas are read-only; anything that saves or needs special data uses a throwaway User.
 */
import type { Locator, Page } from '@playwright/test'
import { test, expect } from '../../../support/fixtures.ts'
import type { BangladeshDays } from '../../../support/bangladesh-day.ts'
import { ensureUserProfile, setPeriodLogs, setPrediction } from '../../../support/db.ts'
import { openDialog } from '../../../support/dialogs.ts'
import { statePath } from '../../../support/personas.ts'
import { suppressAutoPrompts } from '../../../support/prompts.ts'
import { shot as rawShot, type ShotOptions } from '../../support/shot.ts'

/** `shot`, with an element first centred in the viewport so the sticky header and bottom bar never cover it. */
async function shot(page: Page, anchor: string, opts: ShotOptions = {}) {
  await opts.of?.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  return rawShot(page, anchor, opts)
}

/** The card (rounded panel) that contains `inner`. */
const cardOf = (inner: Locator) => inner.locator('xpath=ancestor::div[contains(@class,"rounded-")][1]')

const dayButton = (page: Page, ymd: string) => page.getByRole('grid').locator(`button[data-date="${ymd}"]`)

/** A throwaway User with one profile and `cycles + 1` logged periods, 28 days apart, the latest 10 days ago. */
async function userWithCycles(
  newUser: () => Promise<{ phone: string; page: Page }>,
  days: BangladeshDays,
  cycles: number,
  tier: 'AVERAGE' | 'ARIMA',
  name = 'Nusrat',
) {
  const { phone, page } = await newUser()
  await suppressAutoPrompts(page)
  const profile = await ensureUserProfile(phone, {
    name,
    cycleLength: 28,
    periodLength: 5,
    goal: 'tracking',
    lastPeriodStart: days.dateOf(days.daysAgo(10)),
  })
  const logs = Array.from({ length: cycles + 1 }, (_, i) => {
    const ago = 10 + 28 * (cycles - i)
    return { startDate: days.dateOf(days.daysAgo(ago)), endDate: days.dateOf(days.daysAgo(ago - 4)) }
  })
  await setPeriodLogs(profile.id, logs)
  const next = days.daysFromNow(18)
  await setPrediction(profile.id, {
    tier,
    nextPeriodStart: days.dateOf(next),
    ovulationDay: days.dateOf(days.daysFromNow(4)),
    fertileStart: days.dateOf(days.daysAgo(1)),
    fertileEnd: days.dateOf(days.daysFromNow(5)),
    // The service's own rule: 0.5 + 0.05 per cycle, never above 0.95.
    confidence: Math.min(0.95, 0.5 + cycles * 0.05),
  })
  return { page, profile }
}

test.describe('Dashboard', () => {
  test.describe('with a logging User (Rina)', () => {
    test.use({ storageState: statePath('streaker') })

    test('hero, journey and progress, cycle dates, phase pattern, check-in strip, streak', async ({ page }) => {
      await suppressAutoPrompts(page)
      await page.goto('/dashboard')
      await expect(page.getByTestId('hero-stats')).toBeVisible()
      await expect(page.getByTestId('phase-pattern')).toBeVisible()
      await shot(page, 'db-hero')

      await page.getByTestId('cycle-journey').scrollIntoViewIfNeeded()
      await shot(page, 'db-hero', { suffix: 'journey' })

      await shot(page, 'db-cycle-dates', { of: page.getByTestId('cycle-dates') })
      await shot(page, 'db-phase-pattern', { of: cardOf(page.getByTestId('phase-pattern')) })

      const strip = page.getByRole('group', { name: 'Last 30 days' })
      await expect(page.getByText('-day symptom streak')).toBeVisible()
      await shot(page, 'db-checkin-strip', { of: cardOf(strip) })
      await shot(page, 'db-streak', { of: page.getByText('-day symptom streak').locator('xpath=ancestor::div[contains(@class,"inline-flex")][1]') })
    })
  })

  test.describe('with a User who has not logged for days (Nasrin)', () => {
    test.use({ storageState: statePath('stale') })

    test('logging nudge', async ({ page }) => {
      await suppressAutoPrompts(page)
      await page.goto('/dashboard')
      const nudge = page.getByTestId('logging-nudge')
      await expect(nudge).toBeVisible()
      await shot(page, 'db-nudge', { of: nudge })
    })
  })

  test('first-run and menopause dashboards', async ({ newUser, days }) => {
    const first = await newUser()
    await suppressAutoPrompts(first.page)
    await ensureUserProfile(first.phone, { name: 'Nusrat', goal: 'tracking', lastPeriodStart: null })
    await first.page.goto('/dashboard')
    await expect(first.page.getByTestId('hero-first-period')).toBeVisible()
    await shot(first.page, 'db-first-run')

    const second = await newUser()
    await suppressAutoPrompts(second.page)
    await ensureUserProfile(second.phone, {
      name: 'Shirin',
      goal: 'perimenopause',
      lastPeriodStart: days.dateOf(days.daysAgo(47)),
    })
    await second.page.goto('/dashboard')
    await expect(second.page.getByTestId('hero-menopause')).toBeVisible()
    await shot(second.page, 'db-menopause')
  })
})

test.describe('Logging & Calendar', () => {
  test('log a period, and the date rules', async ({ newUser, days }) => {
    const { page } = await userWithCycles(newUser, days, 1, 'AVERAGE')
    await page.goto('/dashboard')
    await openDialog(page.getByRole('button', { name: 'Log Period' }).first())
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Log Period' })).toBeVisible()
    await shot(page, 'lc-log-period')

    // A date after today is refused (Bangladesh day), with the message below the form.
    await page.getByLabel('Start Date').fill(days.daysFromNow(1))
    await page.getByLabel('End Date').fill(days.daysFromNow(1))
    await dialog.getByRole('button', { name: 'Save Period' }).click()
    await expect(dialog.getByRole('alert')).toContainText('A period cannot start or end after today')
    await shot(page, 'lc-date-rules')

    // Overlap with the period already logged 10 days ago.
    await page.getByLabel('Start Date').fill(days.daysAgo(9))
    await page.getByLabel('End Date').fill(days.daysAgo(8))
    await dialog.getByRole('button', { name: 'Save Period' }).click()
    await expect(dialog.getByRole('alert')).toContainText('This overlaps a period you already logged')
    await shot(page, 'lc-date-rules', { suffix: 'overlap' })
  })

  test('backfill from a past day', async ({ newUser, days }) => {
    const { page } = await userWithCycles(newUser, days, 1, 'AVERAGE')
    const target = days.daysAgo(20)
    await page.goto(`/calendar?month=${target.slice(0, 7)}`)
    await expect(page.getByRole('grid')).toBeVisible()
    await dayButton(page, target).click()
    const addButton = page.getByRole('button', { name: /^Log period from/ }).first()
    await expect(addButton).toBeVisible()
    await shot(page, 'lc-backfill')
    await openDialog(addButton)
    await expect(page.getByLabel('Start Date')).toHaveValue(target)
    await shot(page, 'lc-backfill', { suffix: 'form' })
  })

  test('edit or delete a period', async ({ newUser, days }) => {
    const { page } = await userWithCycles(newUser, days, 1, 'AVERAGE')
    await page.goto('/calendar')
    const entry = page.getByRole('listitem', { name: /^Edit period log starting/ }).first()
    await entry.scrollIntoViewIfNeeded()
    await shot(page, 'lc-edit-delete', { suffix: 'list' })
    await openDialog(entry)
    await expect(page.getByRole('heading', { name: 'Edit Period Log' })).toBeVisible()
    await shot(page, 'lc-edit-delete')
    await page.getByRole('button', { name: 'Delete Period' }).click()
    await expect(page.getByText('Delete this period? Your predictions will be recalculated.')).toBeVisible()
    await shot(page, 'lc-edit-delete', { suffix: 'confirm' })
  })

  test.describe('calendar of a logging User (Rina)', () => {
    test.use({ storageState: statePath('streaker') })

    test('calendar markers and a day\'s logs', async ({ page, days }) => {
      await suppressAutoPrompts(page)
      await page.goto('/calendar')
      await expect(page.getByRole('group', { name: 'Colour key' })).toBeVisible()
      await shot(page, 'lc-calendar')

      // A day with a symptom logged (Rina's headache, yesterday).
      const logged = days.daysAgo(1)
      await page.goto(`/calendar?month=${logged.slice(0, 7)}`)
      await dayButton(page, logged).click()
      await expect(page.getByText('Headache')).toBeVisible()
      await shot(page, 'lc-day-detail')

      // pr-how / pr-fertile-window come from the same page: the "This Cycle" card and the fertile days.
      await page.goto('/calendar')
      const thisCycle = cardOf(page.getByRole('heading', { name: 'This Cycle' }))
      await thisCycle.scrollIntoViewIfNeeded()
      await shot(page, 'pr-how', { of: thisCycle })
      await page.getByRole('grid').scrollIntoViewIfNeeded()
      await shot(page, 'pr-fertile-window')
    })
  })
})

test.describe('Predictions', () => {
  test('confidence meter: still learning, and unlocked', async ({ newUser, days }) => {
    const learning = await userWithCycles(newUser, days, 2, 'AVERAGE')
    await learning.page.goto('/dashboard')
    await expect(learning.page.getByText('2 of 6 complete cycles')).toBeVisible()
    await expect(learning.page.getByText('60% confidence')).toBeVisible()
    await shot(learning.page, 'pr-tiers', { of: cardOf(learning.page.getByRole('heading', { name: 'Cycle progress' })) })

    const unlocked = await userWithCycles(newUser, days, 7, 'ARIMA', 'Shirin')
    await unlocked.page.goto('/dashboard')
    await expect(unlocked.page.getByText('Smart predictions unlocked')).toBeVisible()
    await expect(unlocked.page.getByText('85% confidence')).toBeVisible()
    await shot(unlocked.page, 'pr-improve', { of: cardOf(unlocked.page.getByRole('heading', { name: 'Cycle progress' })) })
  })
})
