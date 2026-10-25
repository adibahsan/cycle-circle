import { test, expect } from '../../support/fixtures.ts'
import { ensureUserProfile, setPeriodLogs, setPrediction, setSymptomLogs } from '../../support/db.ts'

test.describe('Calendar views, colours and day details', () => {
  test('calendar day colours match logged, predicted and fertile states; tapping a day shows logs', async ({
    newUser,
    days,
  }) => {
    const { page, phone } = await newUser()
    const profile = await ensureUserProfile(phone, {
      name: 'Calendar User',
      goal: 'track',
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: days.startOf(days.daysAgo(10)),
    })

    // Logged period: 10 to 6 days ago (with cramps on start day)
    await setPeriodLogs(profile.id, [
      {
        startDate: days.startOf(days.daysAgo(10)),
        endDate: days.startOf(days.daysAgo(6)),
        flowIntensity: 'MEDIUM',
      },
    ])

    await setSymptomLogs(profile.id, [
      {
        date: days.startOf(days.daysAgo(10)),
        category: 'PHYSICAL',
        symptomId: 'cramps',
      },
    ])

    // Prediction: fertile window includes daysAgo(1) and daysFromNow(2), ovulation at daysFromNow(4)
    await setPrediction(profile.id, {
      tier: 'AVERAGE',
      nextPeriodStart: days.startOf(days.daysFromNow(18)),
      ovulationDay: days.startOf(days.daysFromNow(4)),
      fertileStart: days.startOf(days.daysAgo(1)),
      fertileEnd: days.startOf(days.daysFromNow(5)),
      confidence: 0.75,
    })

    const currentMonthYmd = days.today.slice(0, 7)
    await page.goto(`/calendar?month=${currentMonthYmd}`)

    const grid = page.getByRole('grid')
    await expect(grid).toBeVisible()

    // 1. Logged period day has Period in accessible name and menstrual styling
    const periodDayButton = grid.locator(`button[data-date="${days.daysAgo(10)}"]`)
    await expect(periodDayButton).toBeVisible()
    await expect(periodDayButton).toHaveAccessibleName(/Period/)
    await expect(periodDayButton).toHaveCSS('background-color', 'rgb(217, 31, 69)')

    // 2. Fertile window day has Fertile in accessible name
    const fertileDayButton = grid.locator(`button[data-date="${days.daysAgo(1)}"]`)
    await expect(fertileDayButton).toBeVisible()
    await expect(fertileDayButton).toHaveAccessibleName(/Fertile/)

    // 3. Tapping the period day displays its detail card with status pill and logged symptom
    await periodDayButton.click()
    const detailHeading = page.getByRole('heading', { level: 3 }).first()
    await expect(detailHeading).toBeVisible()
    await expect(page.getByText('Period day', { exact: false })).toBeVisible()
    await expect(page.getByText('Cramps')).toBeVisible()

    // 4. Tapping a future fertile day without symptoms displays the empty symptoms note
    const emptyDayButton = grid.locator(`button[data-date="${days.daysFromNow(2)}"]`)
    await emptyDayButton.click()
    await expect(page.getByText(/No symptoms logged/)).toBeVisible()

    // 5. Navigate to the next month to verify predicted period day styling
    const nextMonthButton = page.getByRole('button', { name: 'Next month' })
    await nextMonthButton.click()

    const predictedDate = days.daysFromNow(18)
    const nextMonthGrid = page.getByRole('grid')
    const predictedDayButton = nextMonthGrid.locator(`button[data-date="${predictedDate}"]`)
    await expect(predictedDayButton).toBeVisible()
    await expect(predictedDayButton).toHaveAccessibleName(/Predicted period/)
    await expect(predictedDayButton).toHaveCSS('border-style', 'dashed')
  })
})
