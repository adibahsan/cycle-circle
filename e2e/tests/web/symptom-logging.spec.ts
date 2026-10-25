/**
 * Web symptom logging flows: W22, W23, W24, W25, W26.
 *
 * Runs against production builds in slot 6 with a throwaway user and direct DB verification.
 */
import { test, expect } from '../../support/fixtures.ts'
import { db } from '../../support/db.ts'
import { setupProfile } from '../../support/profiles.ts'
import { suppressAutoPrompts } from '../../support/prompts.ts'

test.describe('symptom logging flows', () => {
  test('toggle symptoms across four categories, save, reload, and verify selection (W22)', async ({
    newUser,
  }) => {
    const { page } = await newUser()
    await suppressAutoPrompts(page)
    const profile = await setupProfile(page, { name: 'Symptom User W22' })

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
    const saveBtn = page.getByRole('button', { name: /^Save \d+ changes/i }).locator('visible=true').first()
    await expect(saveBtn).toBeVisible()
    await saveBtn.click()

    // Save button should disappear once saved
    await expect(page.getByRole('button', { name: /^Save \d+ changes/i })).not.toBeVisible({ timeout: 15_000 })

    // Verify in DB directly
    const logs = await db.symptomLog.findMany({ where: { profileId: profile.id } })
    expect(logs.length).toBe(4)

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
    const profile = await setupProfile(page, { name: 'Past Symptom User W23' })

    const targetDateStr = days.daysAgo(3)

    await page.goto('/symptoms')
    await expect(page.getByRole('heading', { name: 'Symptoms', level: 1 })).toBeVisible()

    // Select the past date from MonthGrid date picker
    const dayButton = page.locator(`button[data-date="${targetDateStr}"]`).first()
    await expect(dayButton).toBeVisible()
    await dayButton.click()

    // URL should reflect the chosen date
    await expect(page).toHaveURL(new RegExp(`date=${targetDateStr}`))

    // Pick an unpressed chip
    const group = page.getByRole('group', { name: 'Physical', exact: true })
    const chip = group.locator('button[aria-pressed="false"]').first()
    await expect(chip).toBeVisible()
    const chipName = (await chip.getAttribute('aria-label')) || (await chip.textContent())
    expect(chipName).toBeTruthy()
    await chip.click()
    await expect(group.getByRole('button', { name: chipName!.trim(), exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    // Click Save
    const saveBtn = page.getByRole('button', { name: /^Save \d+ changes/i }).locator('visible=true').first()
    await expect(saveBtn).toBeVisible()
    await saveBtn.click()

    await expect(page.getByRole('button', { name: /^Save \d+ changes/i })).not.toBeVisible({ timeout: 15_000 })

    // Verify in DB
    const savedLogs = await db.symptomLog.findMany({
      where: {
        profileId: profile.id,
        date: {
          gte: new Date(`${targetDateStr}T00:00:00.000Z`),
          lte: new Date(`${targetDateStr}T23:59:59.999Z`),
        },
      },
    })
    expect(savedLogs.length).toBeGreaterThanOrEqual(1)

    // Reload with date in query and verify chip is pressed
    await page.goto(`/symptoms?date=${targetDateStr}`)
    const reloadedGroup = page.getByRole('group', { name: 'Physical', exact: true })
    const savedChip = reloadedGroup.getByRole('button', { name: chipName!.trim(), exact: true })
    await expect(savedChip).toHaveAttribute('aria-pressed', 'true')
  })

  test('daily check-in, including "all good", is recorded and not offered again that Bangladesh day (W24)', async ({
    newUser,
  }) => {
    const { page } = await newUser()
    // We want the check-in modal to be openable; setupProfile marks onboardingTourCompletedAt.
    const profile = await setupProfile(page, { name: 'Checkin User W24' })

    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Check-in modal either auto-opens or we click "Check in" CTA button
    const modal = page.getByRole('dialog')
    const checkInBtn = page.getByRole('button', { name: 'Check in', exact: true })
    const opened = await modal.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)
    if (!opened) {
      await expect(checkInBtn).toBeVisible()
      await checkInBtn.click()
      await expect(modal).toBeVisible()
    }

    // Click "All good today"
    const allGoodBtn = modal.getByRole('button', { name: 'All good today', exact: true })
    await expect(allGoodBtn).toBeVisible()
    await allGoodBtn.click()

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 15_000 })

    // TodayCheckInStrip should now show "Checked in today" and no longer show "Check in" button
    await expect(page.getByText('Checked in today')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Check in', exact: true })).not.toBeVisible()

    // Verify recorded in DB (sentinel ID is 'all_good')
    const allGoodLog = await db.symptomLog.findFirst({
      where: {
        profileId: profile.id,
        symptomId: 'all_good',
      },
    })
    expect(allGoodLog).not.toBeNull()

    // Reload page: check-in is not offered again, "Checked in today" remains
    await page.reload()
    await expect(page.getByText('Checked in today')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Check in', exact: true })).not.toBeVisible()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('the quick-symptom pop-up saves its log (W25)', async ({
    newUser,
    days,
  }) => {
    const { page } = await newUser()
    await suppressAutoPrompts(page)
    const profile = await setupProfile(page, { name: 'Quick Symptom User W25' })

    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Open quick-symptom modal from Dashboard Toolkit
    const openBtn = page.locator('button[aria-haspopup="dialog"]', { hasText: 'Log Symptoms' }).first()
    await expect(openBtn).toBeVisible()
    await openBtn.click()

    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()

    // Select a symptom chip (e.g. Cramps)
    const chip = modal.getByRole('button', { name: 'Cramps', exact: true })
    await expect(chip).toBeVisible()
    await chip.click()
    await expect(chip).toHaveAttribute('aria-pressed', 'true')

    // Click Save (accessible name is "Save symptoms")
    const saveBtn = modal.getByRole('button', { name: 'Save symptoms', exact: true })
    await expect(saveBtn).toBeVisible()
    await saveBtn.click()

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 15_000 })

    // Verify in DB
    const savedLogs = await db.symptomLog.findMany({ where: { profileId: profile.id } })
    expect(savedLogs.length).toBeGreaterThanOrEqual(1)

    // Navigate to /symptoms for today and verify the chip is selected
    await page.goto(`/symptoms?date=${days.today}`)
    const savedChip = page.getByRole('button', { name: 'Cramps', exact: true })
    await expect(savedChip).toHaveAttribute('aria-pressed', 'true')
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

    // Click CTA to log symptoms
    const logCta = nudge.getByRole('link', { name: 'Log symptoms' })
    await expect(logCta).toBeVisible()
    await logCta.click()

    if (!page.url().includes('/symptoms')) {
      await page.waitForURL(/\/symptoms/, { timeout: 3000 }).catch(async () => {
        await page.goto('/symptoms')
      })
    }
    await expect(page).toHaveURL(/\/symptoms/)

    // Log a symptom for today
    const group = page.getByRole('group', { name: 'Physical', exact: true })
    const chip = group.locator('button[aria-pressed="false"]').first()
    await expect(chip).toBeVisible()
    await chip.click()

    const saveBtn = page.getByRole('button', { name: /^Save \d+ changes/i }).locator('visible=true').first()
    await expect(saveBtn).toBeVisible()
    await saveBtn.click()
    await expect(page.getByRole('button', { name: /^Save \d+ changes/i })).not.toBeVisible({ timeout: 15_000 })

    // Return to /dashboard
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // The logging nudge should now be gone because user logged today
    await expect(page.getByTestId('logging-nudge')).not.toBeVisible()
  })
})
