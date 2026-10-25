import { test, expect } from '../../support/fixtures.ts'
import { ensureUserProfile, setPeriodLogs, setSymptomLogs } from '../../support/db.ts'

test.describe('Insights states and charts', () => {
  test('empty state renders when no data has been logged', async ({ newUser }) => {
    const { page, phone } = await newUser()
    await ensureUserProfile(phone, {
      name: 'Empty Insights User',
      goal: 'track',
      lastPeriodStart: null,
    })

    await page.goto('/insights')

    await expect(page.getByRole('heading', { level: 1, name: 'Insights' })).toBeVisible()
    const emptyState = page.getByTestId('insights-empty')
    await expect(emptyState).toBeVisible()
    await expect(emptyState.getByText('Not enough data yet')).toBeVisible()

    // No chart headings or partial missing note
    await expect(page.getByTestId('insights-missing-note')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Cycle length trend' })).toHaveCount(0)
  })

  test('partial state renders symptom frequency chart and informs of missing cycle charts', async ({
    newUser,
    days,
  }) => {
    const { page, phone } = await newUser()
    const profile = await ensureUserProfile(phone, {
      name: 'Partial Insights User',
      goal: 'track',
      lastPeriodStart: null,
    })

    // Log symptoms only, no period logs (so cycle-dependent charts have no data)
    await setSymptomLogs(profile.id, [
      { date: days.startOf(days.daysAgo(3)), category: 'PHYSICAL', symptomId: 'cramps' },
      { date: days.startOf(days.daysAgo(2)), category: 'PHYSICAL', symptomId: 'headache' },
      { date: days.startOf(days.daysAgo(1)), category: 'MOOD', symptomId: 'anxious' },
    ])

    await page.goto('/insights')

    // Symptom frequency is visible
    await expect(page.getByRole('heading', { name: 'Symptom frequency' })).toBeVisible()

    // Missing note informs user about needing more logged cycles
    const missingNote = page.getByTestId('insights-missing-note')
    await expect(missingNote).toBeVisible()
    await expect(missingNote).toContainText(/Not enough data yet for: Cycle Length Trend/i)

    // Cycle length trend is missing
    await expect(page.getByRole('heading', { name: 'Cycle length trend' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Period regularity' })).toHaveCount(0)
  })

  test('full insights dashboard renders all 4 charts when sufficient data exists', async ({ newUser, days }) => {
    const { page, phone } = await newUser()
    const profile = await ensureUserProfile(phone, {
      name: 'Full Insights User',
      goal: 'track',
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: days.startOf(days.daysAgo(15)),
    })

    // 4 period logs -> 3 complete cycles
    await setPeriodLogs(profile.id, [
      { startDate: days.startOf(days.daysAgo(99)), endDate: days.startOf(days.daysAgo(95)), flowIntensity: 'MEDIUM' },
      { startDate: days.startOf(days.daysAgo(71)), endDate: days.startOf(days.daysAgo(67)), flowIntensity: 'MEDIUM' },
      { startDate: days.startOf(days.daysAgo(43)), endDate: days.startOf(days.daysAgo(39)), flowIntensity: 'MEDIUM' },
      { startDate: days.startOf(days.daysAgo(15)), endDate: days.startOf(days.daysAgo(11)), flowIntensity: 'MEDIUM' },
    ])

    // Symptom logs
    await setSymptomLogs(profile.id, [
      { date: days.startOf(days.daysAgo(20)), category: 'PHYSICAL', symptomId: 'cramps' },
      { date: days.startOf(days.daysAgo(10)), category: 'MOOD', symptomId: 'calm' },
    ])

    await page.goto('/insights')

    // All 4 chart sections are rendered
    await expect(page.getByRole('heading', { name: 'Cycle length trend' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Symptom frequency' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Period regularity' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Fertile window history' })).toBeVisible()

    // No missing chart note
    await expect(page.getByTestId('insights-missing-note')).toHaveCount(0)

    // Chart type controls (Line, Area, Bar) work
    const areaBtn = page.getByRole('button', { name: 'Area', exact: true })
    await expect(areaBtn).toBeVisible()
    await areaBtn.click()
    await expect(areaBtn).toHaveAttribute('aria-pressed', 'true')
  })
})
