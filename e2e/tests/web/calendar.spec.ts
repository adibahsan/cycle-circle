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

    // Prediction: fertile window includes daysAgo(1) and daysFromNow(2), ovulation at daysFromNow(4),
    // next period predicted at daysFromNow(18)
    await setPrediction(profile.id, {
      tier: 'AVERAGE',
      nextPeriodStart: days.startOf(days.daysFromNow(18)),
      ovulationDay: days.startOf(days.daysFromNow(4)),
      fertileStart: days.startOf(days.daysAgo(1)),
      fertileEnd: days.startOf(days.daysFromNow(5)),
      confidence: 0.75,
    })

    // Helper to navigate to the month of the asserted date so MonthGrid in-month rendering
    // is completely independent of today's day-of-month (fixes date flake #123 Finding 1).
    async function showMonthOf(dateStr: string) {
      const targetMonth = dateStr.slice(0, 7)
      const currentUrl = page.url()
      const currentParam = currentUrl.includes('?') ? new URL(currentUrl).searchParams.get('month') : null
      if (currentParam !== targetMonth) {
        await page.goto(`/calendar?month=${targetMonth}`)
        await expect(page.getByRole('grid')).toBeVisible()
      }
    }

    // 1. Period start day has Period accessible name and solid menstrual colour (#123 Finding 2)
    await showMonthOf(days.daysAgo(10))
    const grid = page.getByRole('grid')
    const periodStartButton = grid.locator(`button[data-date="${days.daysAgo(10)}"]`)
    await expect(periodStartButton).toBeVisible()
    await expect(periodStartButton).toHaveAccessibleName(/Period/)
    await expect(periodStartButton).not.toHaveAccessibleName(/Predicted/)
    await expect(periodStartButton).toHaveCSS('background-color', 'rgb(217, 31, 69)')

    // 2. Mid-period day (daysAgo(8)) has Period accessible name and menstrual colour (#123 Finding 2)
    await showMonthOf(days.daysAgo(8))
    const midPeriodButton = page.getByRole('grid').locator(`button[data-date="${days.daysAgo(8)}"]`)
    await expect(midPeriodButton).toBeVisible()
    await expect(midPeriodButton).toHaveAccessibleName(/Period/)
    await expect(midPeriodButton).not.toHaveAccessibleName(/Predicted/)
    await expect(midPeriodButton).toHaveCSS('background-color', 'rgb(217, 31, 69)')

    // 3. Past negative day (daysAgo(11)) is plain (not period/fertile) with transparent bg (#123 Finding 2)
    await showMonthOf(days.daysAgo(11))
    const pastNegativeButton = page.getByRole('grid').locator(`button[data-date="${days.daysAgo(11)}"]`)
    await expect(pastNegativeButton).toBeVisible()
    await expect(pastNegativeButton).not.toHaveAccessibleName(/Period|Fertile|Ovulation|Predicted/)
    await expect(pastNegativeButton).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')

    // 4. Fertile window day has Fertile in accessible name (#123 Finding 2)
    await showMonthOf(days.daysAgo(1))
    const fertileDayButton = page.getByRole('grid').locator(`button[data-date="${days.daysAgo(1)}"]`)
    await expect(fertileDayButton).toBeVisible()
    await expect(fertileDayButton).toHaveAccessibleName(/Fertile/)
    await expect(fertileDayButton).not.toHaveAccessibleName(/Ovulation/)

    // 5. Ovulation day has Ovulation in accessible name and mint/teal styling (#123 Finding 2)
    await showMonthOf(days.daysFromNow(4))
    const ovulationDayButton = page.getByRole('grid').locator(`button[data-date="${days.daysFromNow(4)}"]`)
    await expect(ovulationDayButton).toBeVisible()
    await expect(ovulationDayButton).toHaveAccessibleName(/Ovulation/)
    await expect(ovulationDayButton).toHaveCSS('background-color', 'rgb(13, 127, 105)')

    // 6. Future negative day (daysFromNow(6)) has no period/fertile/ovulation/predicted status (#123 Finding 2)
    await showMonthOf(days.daysFromNow(6))
    const futureNegativeButton = page.getByRole('grid').locator(`button[data-date="${days.daysFromNow(6)}"]`)
    await expect(futureNegativeButton).toBeVisible()
    await expect(futureNegativeButton).not.toHaveAccessibleName(/Period|Fertile|Ovulation/)
    await expect(futureNegativeButton).not.toHaveCSS('background-color', 'rgb(217, 31, 69)')
    await expect(futureNegativeButton).not.toHaveCSS('background-color', 'rgb(13, 127, 105)')
    await expect(futureNegativeButton).not.toHaveCSS('border-style', 'dashed')

    // 7. Detail sheet: scoped to detail region, asserts clicked date in heading and cramps (#123 Finding 3)
    await showMonthOf(days.daysAgo(10))
    await page.getByRole('grid').locator(`button[data-date="${days.daysAgo(10)}"]`).click()
    const detailRegion = page.locator('.rounded-panel').filter({ has: page.getByRole('button', { name: 'Close' }) })
    await expect(detailRegion).toBeVisible()
    const detailHeading = detailRegion.getByRole('heading', { level: 3 })
    await expect(detailHeading).toBeVisible()
    const clickedDayNumber = String(parseInt(days.daysAgo(10).slice(8), 10))
    await expect(detailHeading).toContainText(clickedDayNumber)
    await expect(detailRegion.getByText('Period day', { exact: false })).toBeVisible()
    await expect(detailRegion.getByText('Cramps')).toBeVisible()

    // 8. Tapping an empty fertile day displays empty note and no cramps (#123 Finding 3)
    await showMonthOf(days.daysFromNow(2))
    const emptyDayButton = page.getByRole('grid').locator(`button[data-date="${days.daysFromNow(2)}"]`)
    await emptyDayButton.click()
    await expect(detailRegion).toBeVisible()
    const emptyDayNumber = String(parseInt(days.daysFromNow(2).slice(8), 10))
    await expect(detailHeading).toContainText(emptyDayNumber)
    await expect(detailRegion.getByText(/No symptoms logged/)).toBeVisible()
    await expect(detailRegion.getByText('Cramps')).toHaveCount(0)

    // 9. Predicted period day styling on month of prediction (dashed menstrual outline) (#123 Finding 1 & 2)
    const predictedDate = days.daysFromNow(18)
    await showMonthOf(predictedDate)
    const predictedDayButton = page.getByRole('grid').locator(`button[data-date="${predictedDate}"]`)
    await expect(predictedDayButton).toBeVisible()
    await expect(predictedDayButton).toHaveAccessibleName(/Predicted period/)
    await expect(predictedDayButton).toHaveCSS('border-style', 'dashed')
  })
})
