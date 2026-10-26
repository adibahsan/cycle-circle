import { test, expect } from '../../support/fixtures.ts'
import { ensureUserProfile, setPeriodLogs, setPrediction } from '../../support/db.ts'

test.describe('Prediction tier and confidence recalculation', () => {
  test('prediction tier and confidence update after enough cycles are logged', async ({ newUser, days }) => {
    const { page, phone } = await newUser()
    const profile = await ensureUserProfile(phone, {
      name: 'Prediction User',
      goal: 'track',
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: days.dateOf(days.daysAgo(30)),
    })

    // Seed 6 past period logs -> 5 complete cycles (< 6 cycles threshold for ARIMA)
    await setPeriodLogs(profile.id, [
      { startDate: days.dateOf(days.daysAgo(170)), endDate: days.dateOf(days.daysAgo(166)), flowIntensity: 'MEDIUM' },
      { startDate: days.dateOf(days.daysAgo(142)), endDate: days.dateOf(days.daysAgo(138)), flowIntensity: 'MEDIUM' },
      { startDate: days.dateOf(days.daysAgo(114)), endDate: days.dateOf(days.daysAgo(110)), flowIntensity: 'MEDIUM' },
      { startDate: days.dateOf(days.daysAgo(86)), endDate: days.dateOf(days.daysAgo(82)), flowIntensity: 'MEDIUM' },
      { startDate: days.dateOf(days.daysAgo(58)), endDate: days.dateOf(days.daysAgo(54)), flowIntensity: 'MEDIUM' },
      { startDate: days.dateOf(days.daysAgo(30)), endDate: days.dateOf(days.daysAgo(26)), flowIntensity: 'MEDIUM' },
    ])

    // Set initial average prediction for 5 cycles: 75% confidence, tier AVERAGE.
    // Seed nextPeriodStart in the future (non-late) so the late-period dialog does not
    // auto-open and block the asserts (#123 Finding 11).
    await setPrediction(profile.id, {
      tier: 'AVERAGE',
      nextPeriodStart: days.dateOf(days.daysFromNow(2)),
      ovulationDay: days.dateOf(days.daysAgo(12)),
      fertileStart: days.dateOf(days.daysAgo(17)),
      fertileEnd: days.dateOf(days.daysAgo(11)),
      confidence: 0.75,
    })

    // Check initial prediction via API
    const initialRes = await page.request.get(`/api/predictions?profileId=${profile.id}`)
    expect(initialRes.ok()).toBe(true)
    const initialJson = await initialRes.json()
    expect(initialJson.prediction).toMatchObject({
      tier: 'AVERAGE',
      confidence: 0.75,
    })
    expect(initialJson.tierExplanation).toContain('Tier 1')

    // On dashboard, unlock meter shows 5 of 6 complete cycles and 75% confidence
    await page.goto('/dashboard')
    const main = page.locator('main')
    await expect(main.getByText('5 of 6 complete cycles')).toBeVisible()
    await expect(main.getByText('75% confidence')).toBeVisible()

    // Dismiss check-in prompt if it auto-opens so it does not block the UI
    const allGoodBtn = page.getByRole('button', { name: /all good/i })
    try {
      await allGoodBtn.waitFor({ state: 'visible', timeout: 3_000 })
      await allGoodBtn.click()
      await expect(allGoodBtn).toBeHidden()
    } catch {
      // Prompt did not appear
    }

    // Log the 7th period (completing the 6th cycle) through the real UI flow (#123 Finding 5)
    await page.getByRole('button', { name: /log period/i }).click()
    const logModal = page.getByRole('dialog').filter({ hasText: 'Log Period' })
    await expect(logModal).toBeVisible()
    await logModal.getByLabel(/start date/i).fill(days.daysAgo(2))
    await logModal.getByLabel(/end date/i).fill(days.today)
    await logModal.getByRole('button', { name: /save period/i }).click()
    await expect(logModal).toBeHidden()

    // Prediction should have recalculated to ARIMA tier and 80% confidence
    const updatedRes = await page.request.get(`/api/predictions?profileId=${profile.id}`)
    expect(updatedRes.ok()).toBe(true)
    const updatedJson = await updatedRes.json()
    expect(updatedJson.prediction).toMatchObject({
      tier: 'ARIMA',
      confidence: 0.8,
    })
    expect(updatedJson.tierExplanation).toContain('Tier 2: ARIMA')

    // Dashboard after refresh reflects the unlocked status, updated confidence,
    // and verifies "75% confidence" and "5 of 6 complete cycles" disappeared (#123 Finding 5)
    await page.reload()
    await expect(main.getByText('Smart predictions unlocked')).toBeVisible()
    await expect(main.getByText('80% confidence')).toBeVisible()
    await expect(main.getByText('75% confidence')).toBeHidden()
    await expect(main.getByText('5 of 6 complete cycles')).toBeHidden()
  })
})
