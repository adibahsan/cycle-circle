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
      lastPeriodStart: days.startOf(days.daysAgo(30)),
    })

    // Seed 6 past period logs -> 5 complete cycles (< 6 cycles threshold for ARIMA)
    await setPeriodLogs(profile.id, [
      { startDate: days.startOf(days.daysAgo(170)), endDate: days.startOf(days.daysAgo(166)), flowIntensity: 'MEDIUM' },
      { startDate: days.startOf(days.daysAgo(142)), endDate: days.startOf(days.daysAgo(138)), flowIntensity: 'MEDIUM' },
      { startDate: days.startOf(days.daysAgo(114)), endDate: days.startOf(days.daysAgo(110)), flowIntensity: 'MEDIUM' },
      { startDate: days.startOf(days.daysAgo(86)), endDate: days.startOf(days.daysAgo(82)), flowIntensity: 'MEDIUM' },
      { startDate: days.startOf(days.daysAgo(58)), endDate: days.startOf(days.daysAgo(54)), flowIntensity: 'MEDIUM' },
      { startDate: days.startOf(days.daysAgo(30)), endDate: days.startOf(days.daysAgo(26)), flowIntensity: 'MEDIUM' },
    ])

    // Set initial average prediction for 5 cycles: 75% confidence, tier AVERAGE
    await setPrediction(profile.id, {
      tier: 'AVERAGE',
      nextPeriodStart: days.startOf(days.daysAgo(2)),
      ovulationDay: days.startOf(days.daysAgo(16)),
      fertileStart: days.startOf(days.daysAgo(21)),
      fertileEnd: days.startOf(days.daysAgo(15)),
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

    // On dashboard, unlock meter shows 5 of 6 complete cycles
    await page.goto('/dashboard')
    const main = page.locator('main')
    await expect(main.getByText('5 of 6 complete cycles')).toBeVisible()
    await expect(main.getByText('75% confidence')).toBeVisible()

    // Now log the 7th period (completes the 6th cycle) through the real API
    const logRes = await page.request.post('/api/tracking/period-logs', {
      data: {
        profileId: profile.id,
        startDate: days.daysAgo(2),
        endDate: days.today,
        flowIntensity: 'MEDIUM',
      },
    })
    expect(logRes.ok()).toBe(true)

    // Prediction should have recalculated to ARIMA tier and 80% confidence
    const updatedRes = await page.request.get(`/api/predictions?profileId=${profile.id}`)
    expect(updatedRes.ok()).toBe(true)
    const updatedJson = await updatedRes.json()
    expect(updatedJson.prediction).toMatchObject({
      tier: 'ARIMA',
      confidence: 0.8,
    })
    expect(updatedJson.tierExplanation).toContain('Tier 2: ARIMA')

    // Dashboard after refresh reflects the unlocked status and updated confidence
    await page.reload()
    await expect(main.getByText('Smart predictions unlocked')).toBeVisible()
    await expect(main.getByText('80% confidence')).toBeVisible()
  })
})
