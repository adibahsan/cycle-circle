/**
 * Web symptom logging flows: W22, W23, W24, W25, W26.
 *
 * Runs against production builds in slot 6 with a throwaway user and direct DB verification.
 */
import { test, expect } from '../../support/fixtures.ts'
import { db } from '../../support/db.ts'
import { setupProfile } from '../../support/profiles.ts'
import { suppressAutoPrompts } from '../../support/prompts.ts'
import { openDialog } from '../../support/dialogs.ts'

test.describe('symptom logging flows', () => {
  test('toggle symptoms across four categories, save, reload, and verify selection (W22)', async ({
    newUser,
  }) => {
    const { page } = await newUser()
    await suppressAutoPrompts(page)
    await setupProfile(page, { name: 'Symptom User W22' })

    await page.goto('/symptoms')
    await expect(page.getByRole('heading', { name: 'Symptoms', level: 1 })).toBeVisible()

    const categories = [
      { key: 'physical', label: 'Physical', symptom: 'Cramps' },
      { key: 'mood', label: 'Mood', symptom: 'Happy' },
      { key: 'discharge', label: 'Discharge', symptom: 'Dry' },
      { key: 'lifestyle', label: 'Lifestyle', symptom: 'Good Sleep' },
    ] as const

    for (const cat of categories) {
      const tab = page.getByRole('tab', { name: new RegExp(`^${cat.label}`, 'i') })
      await tab.click()
      await expect(tab).toHaveAttribute('aria-selected', 'true')

      const group = page.getByRole('group', { name: cat.label, exact: true })
      const chip = group.getByRole('button', { name: cat.symptom, exact: true })
      await expect(chip).toBeVisible()

      await chip.click()
      await expect(chip).toHaveAttribute('aria-pressed', 'true')
    }

    // Save changes (desktop inline or mobile floating bar)
    const saveBtn = page.getByRole('button', { name: /^Save \d+ changes/i }).filter({ visible: true }).first()
    await expect(saveBtn).toBeVisible()
    await saveBtn.click()

    // Save button should disappear once saved
    await expect(page.getByRole('button', { name: /^Save \d+ changes/i })).not.toBeVisible({ timeout: 15_000 })

    // Reload page
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Symptoms', level: 1 })).toBeVisible()

    // Check each category still has the selected chip pressed
    for (const cat of categories) {
      const tab = page.getByRole('tab', { name: new RegExp(`^${cat.label}`, 'i') })
      await tab.click()
      await expect(tab).toHaveAttribute('aria-selected', 'true')

      const group = page.getByRole('group', { name: cat.label, exact: true })
      const chip = group.getByRole('button', { name: cat.symptom, exact: true })
      await expect(chip).toBeVisible()
      await expect(chip).toHaveAttribute('aria-pressed', 'true')
    }
  })

  test('log symptoms for a past date with the date picker (W23)', async ({
    newUser,
    days,
  }) => {
    const { page } = await newUser()
    await suppressAutoPrompts(page)
    await setupProfile(page, { name: 'Past Symptom User W23' })

    const targetDateStr = days.daysAgo(3)

    await page.goto('/symptoms')
    await expect(page.getByRole('heading', { name: 'Symptoms', level: 1 })).toBeVisible()

    // Three days ago can fall in the previous month (1st to 3rd): step the picker back to it.
    if (targetDateStr.slice(0, 7) !== days.today.slice(0, 7)) {
      await page.getByRole('button', { name: 'Previous month' }).click()
    }
    const dayButton = page.locator(`button[data-date="${targetDateStr}"]`).first()
    await expect(dayButton).toBeVisible()
    await dayButton.click()
    await expect(page).toHaveURL(new RegExp(`date=${targetDateStr}`))

    const group = page.getByRole('group', { name: 'Physical', exact: true })
    const chip = group.getByRole('button', { name: 'Cramps', exact: true })
    await expect(chip).toHaveAttribute('aria-pressed', 'false')
    await chip.click()
    await expect(chip).toHaveAttribute('aria-pressed', 'true')

    const saveBtn = page.getByRole('button', { name: /^Save \d+ changes/i }).filter({ visible: true }).first()
    await expect(saveBtn).toBeVisible()
    await saveBtn.click()
    await expect(page.getByRole('button', { name: /^Save \d+ changes/i })).not.toBeVisible({ timeout: 15_000 })

    // The log belongs to that day: pressed there, not on today
    await page.goto(`/symptoms?date=${targetDateStr}`)
    await expect(page.getByRole('group', { name: 'Physical', exact: true }).getByRole('button', { name: 'Cramps', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.goto(`/symptoms?date=${days.today}`)
    await expect(page.getByRole('group', { name: 'Physical', exact: true }).getByRole('button', { name: 'Cramps', exact: true })).toHaveAttribute('aria-pressed', 'false')
  })

  test('daily check-in, including "all good", is recorded and not offered again that Bangladesh day (W24)', async ({
    newUser,
    days,
  }) => {
    // Between 00:00 and 06:00 Bangladesh the server's UTC day is yesterday (#155)
    test.fail(days.now.getUTCHours() >= 18, 'https://github.com/adibahsan/cycle-circle/issues/155')
    const { page } = await newUser()
    // No suppressAutoPrompts: for a fresh profile with the tour done, the check-in is the one auto-prompt.
    const profile = await setupProfile(page, { name: 'Checkin User W24' })

    await page.goto('/dashboard')
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()
    await expect(modal.getByRole('heading', { name: 'How are you feeling today?' })).toBeVisible()

    await modal.getByRole('button', { name: 'All good today', exact: true }).click()
    await expect(modal).toBeHidden({ timeout: 15_000 })

    // Strip shows the done state and no longer offers the check-in
    await expect(page.getByText("You've checked in today")).toBeVisible()
    await expect(page.getByRole('button', { name: 'Check in', exact: true })).toHaveCount(0)

    // The sentinel row has no screen of its own
    const allGoodLogs = await db.symptomLog.findMany({ where: { profileId: profile.id, symptomId: 'all_good' } })
    expect(allGoodLogs).toHaveLength(1)
    expect(allGoodLogs[0]!.date).toEqual(new Date(`${days.today}T00:00:00.000Z`))

    // Forget the "already shown today" cadence so only the logged state can keep the prompt away
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.reload()
    await expect(page.getByText("You've checked in today")).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Check in', exact: true })).toHaveCount(0)
  })

  test('a normal check-in with a chosen symptom is recorded for today (W24)', async ({ newUser, days }) => {
    // Between 00:00 and 06:00 Bangladesh the server's UTC day is yesterday (#155)
    test.fail(days.now.getUTCHours() >= 18, 'https://github.com/adibahsan/cycle-circle/issues/155')
    const { page } = await newUser()
    const profile = await setupProfile(page, { name: 'Checkin Chip User W24' })

    await page.goto('/dashboard')
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()

    const chip = modal.getByRole('button', { name: 'Cramps', exact: true })
    await chip.click()
    await expect(chip).toHaveAttribute('aria-pressed', 'true')
    await modal.getByRole('button', { name: /^Save/ }).click()
    await expect(modal).toBeHidden({ timeout: 15_000 })
    await expect(page.getByText("You've checked in today")).toBeVisible()

    // Visible on the symptoms screen for today after a reload
    await page.goto(`/symptoms?date=${days.today}`)
    await expect(
      page.getByRole('group', { name: 'Physical', exact: true }).getByRole('button', { name: 'Cramps', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')

    // And not as the all-good sentinel
    expect(await db.symptomLog.count({ where: { profileId: profile.id, symptomId: 'all_good' } })).toBe(0)

    await page.goto('/dashboard')
    await expect(page.getByText("You've checked in today")).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('the quick-symptom pop-up saves its log (W25)', async ({
    newUser,
    days,
  }) => {
    const { page } = await newUser()
    await suppressAutoPrompts(page)
    await setupProfile(page, { name: 'Quick Symptom User W25' })

    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const openBtn = page.getByRole('button', { name: 'Log Symptoms' }).first()
    await openDialog(openBtn)

    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()

    const chip = modal.getByRole('button', { name: 'Cramps', exact: true })
    await chip.click()
    await expect(chip).toHaveAttribute('aria-pressed', 'true')
    await modal.getByRole('button', { name: 'Save symptoms', exact: true }).click()
    await expect(modal).toBeHidden({ timeout: 15_000 })

    // Today's symptoms screen shows exactly this symptom, and yesterday's does not
    await page.goto(`/symptoms?date=${days.today}`)
    const physical = page.getByRole('group', { name: 'Physical', exact: true })
    await expect(physical.getByRole('button', { name: 'Cramps', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(physical.getByRole('button', { pressed: true })).toHaveCount(1)
    await page.goto(`/symptoms?date=${days.daysAgo(1)}`)
    await expect(
      page.getByRole('group', { name: 'Physical', exact: true }).getByRole('button', { name: 'Cramps', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  test('logging nudge appears after three days with no logs, and disappears after logging (W26)', async ({
    newUser,
    days,
  }) => {
    const { page } = await newUser()
    await suppressAutoPrompts(page)
    const profile = await setupProfile(page, { name: 'Nudge User W26' })

    // Seed a past log 4 days ago so daysSinceLastLog is 4 (>= 3 days)
    const fourDaysAgo = days.daysAgo(4)
    await db.symptomLog.create({
      data: {
        profileId: profile.id,
        category: 'PHYSICAL',
        symptomId: 'headache',
        value: 'headache',
        date: new Date(`${fourDaysAgo}T12:00:00.000Z`),
        createdAt: new Date(),
      },
    })

    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // The logging nudge should be visible with stale copy
    const nudge = page.getByTestId('logging-nudge')
    await expect(nudge).toBeVisible()
    await expect(nudge.getByText('How are you feeling today?')).toBeVisible()
    await expect(nudge.getByText("It's been a few days")).toBeVisible()

    // Click CTA to log symptoms
    const logCta = nudge.getByRole('link', { name: 'Log symptoms' })
    await expect(logCta).toBeVisible()
    // The nudge swaps its server-rendered node for the animated one when it mounts; a click in that
    // instant is lost, so retry the click (not a navigation shortcut) until the CTA lands on /symptoms.
    await expect(async () => {
      await logCta.click({ timeout: 2_000 })
      await expect(page).toHaveURL(/\/symptoms/, { timeout: 2_000 })
    }).toPass({ timeout: 15_000 })

    // Log a symptom for today
    const group = page.getByRole('group', { name: 'Physical', exact: true })
    const chip = group.getByRole('button', { name: 'Cramps', exact: true })
    await chip.click()
    await expect(chip).toHaveAttribute('aria-pressed', 'true')

    const saveBtn = page.getByRole('button', { name: /^Save \d+ changes/i }).filter({ visible: true }).first()
    await expect(saveBtn).toBeVisible()
    await saveBtn.click()
    await expect(page.getByRole('button', { name: /^Save \d+ changes/i })).not.toBeVisible({ timeout: 15_000 })

    // Return to /dashboard
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Wait for another dashboard element so absence is not just "not rendered yet"
    await expect(page.getByRole('button', { name: 'Log Symptoms' }).first()).toBeVisible()
    await expect(page.getByTestId('logging-nudge')).toHaveCount(0)
  })
})
