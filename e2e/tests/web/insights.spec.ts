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
    const emptyState = // The empty state is a role=status with no accessible name; match it by role + text.
    page.getByRole('status').filter({ hasText: 'Not enough data yet' })
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
      { date: days.dateOf(days.daysAgo(3)), category: 'PHYSICAL', symptomId: 'cramps' },
      { date: days.dateOf(days.daysAgo(2)), category: 'PHYSICAL', symptomId: 'headache' },
      { date: days.dateOf(days.daysAgo(1)), category: 'MOOD', symptomId: 'anxious' },
    ])

    await page.goto('/insights')

    // Symptom frequency is visible
    await expect(page.getByRole('heading', { name: 'Symptom frequency' })).toBeVisible()

    // Full missing note informs user of all missing cycle charts (#123 Finding 8)
    const missingNote = page.getByTestId('insights-missing-note')
    await expect(missingNote).toBeVisible()
    await expect(missingNote).toContainText(
      'Not enough data yet for: Cycle Length Trend, Period Regularity, Fertile Window History. Keep logging to unlock them.'
    )

    // Cycle-dependent charts are absent
    await expect(page.getByRole('heading', { name: 'Cycle length trend' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Period regularity' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Fertile window history' })).toHaveCount(0)

    // Symptom frequency chart shows real data (#123 Finding 8)
    await expect(page.getByRole('region', { name: 'Symptom frequency' })).toContainText(/Physical/i)
    await expect(page.getByRole('region', { name: 'Symptom frequency' })).toContainText(/of 3 logs/i)
    const symptomTable = page.getByRole('table', { name: 'Symptom frequency' })
    await expect(symptomTable).toBeAttached()
    await expect(symptomTable).toContainText('Physical')
    await expect(symptomTable).toContainText('2')
    await expect(symptomTable).toContainText('Mood')
    await expect(symptomTable).toContainText('1')
    await expect(page.getByRole('group', { name: 'Symptom frequency' })).toBeVisible()
  })

  test('full insights dashboard renders all 4 charts when sufficient data exists', async ({ newUser, days }) => {
    const { page, phone } = await newUser()
    const profile = await ensureUserProfile(phone, {
      name: 'Full Insights User',
      goal: 'track',
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: days.dateOf(days.daysAgo(15)),
    })

    // 4 period logs -> 3 complete cycles
    await setPeriodLogs(profile.id, [
      { startDate: days.dateOf(days.daysAgo(99)), endDate: days.dateOf(days.daysAgo(95)), flowIntensity: 'MEDIUM' },
      { startDate: days.dateOf(days.daysAgo(71)), endDate: days.dateOf(days.daysAgo(67)), flowIntensity: 'MEDIUM' },
      { startDate: days.dateOf(days.daysAgo(43)), endDate: days.dateOf(days.daysAgo(39)), flowIntensity: 'MEDIUM' },
      { startDate: days.dateOf(days.daysAgo(15)), endDate: days.dateOf(days.daysAgo(11)), flowIntensity: 'MEDIUM' },
    ])

    // Symptom logs
    await setSymptomLogs(profile.id, [
      { date: days.dateOf(days.daysAgo(20)), category: 'PHYSICAL', symptomId: 'cramps' },
      { date: days.dateOf(days.daysAgo(10)), category: 'MOOD', symptomId: 'calm' },
    ])

    await page.goto('/insights')

    // All 4 chart sections are rendered
    await expect(page.getByRole('heading', { name: 'Cycle length trend' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Symptom frequency' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Period regularity' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Fertile window history' })).toBeVisible()

    // No missing chart note
    await expect(page.getByTestId('insights-missing-note')).toHaveCount(0)

    // Assert chart content: values and accessible summaries (#123 Finding 7)
    // 1. Cycle length trend: summary and data table
    await expect(page.getByRole('region', { name: 'Cycle length trend' })).toContainText(/3 cycles/i)
    await expect(page.getByRole('region', { name: 'Cycle length trend' })).toContainText(/from 28 to 28 days/i)
    const cycleTable = page.getByRole('table', { name: 'Cycle length trend' })
    await expect(cycleTable).toBeAttached()
    await expect(cycleTable).toContainText('28')

    // 2. Period regularity: mean, variation and stable badge
    const regularityCard = page.getByRole('region', { name: 'Period regularity' })
    await expect(regularityCard.getByText('28', { exact: true })).toBeVisible()
    await expect(regularityCard.getByText('±0', { exact: true })).toBeVisible()
    await expect(regularityCard.getByText('Stable', { exact: true })).toBeVisible()

    // 3. Fertile window history: summary and span
    await expect(page.getByRole('region', { name: 'Fertile window history' })).toContainText('Showing the last 3 fertile windows.')
    await expect(
      page.getByRole('table', { name: 'Fertile window history' }).getByRole('cell', { name: '7', exact: true }).first(),
    ).toBeAttached()

    // 4. Symptom frequency: summary and data table
    await expect(page.getByRole('region', { name: 'Symptom frequency' })).toContainText(/of 2 logs/i)
    const symptomTable = page.getByRole('table', { name: 'Symptom frequency' })
    await expect(symptomTable).toBeAttached()
    await expect(symptomTable).toContainText('Physical')
    await expect(symptomTable).toContainText('Mood')

    // Chart type controls (Line, Area, Bar) toggle and change the chart (#123 Finding 7)
    const lineBtn = page.getByRole('button', { name: 'Line', exact: true })
    const areaBtn = page.getByRole('button', { name: 'Area', exact: true })
    const barBtn = page.getByRole('button', { name: 'Bar', exact: true })

    await expect(lineBtn).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('group', { name: 'Cycle length trend, Line' })).toBeVisible()

    // Toggle to Area
    await areaBtn.click()
    await expect(areaBtn).toHaveAttribute('aria-pressed', 'true')
    await expect(lineBtn).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByRole('group', { name: 'Cycle length trend, Area' })).toBeVisible()

    // Toggle to Bar
    await barBtn.click()
    await expect(barBtn).toHaveAttribute('aria-pressed', 'true')
    await expect(areaBtn).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByRole('group', { name: 'Cycle length trend, Bar' })).toBeVisible()
  })
})
