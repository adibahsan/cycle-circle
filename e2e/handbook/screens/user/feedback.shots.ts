/**
 * Handbook chapter "Feedback" (docs/handbook/chapters/feedback.md), ticket #243.
 * Demo User and demo wording only.
 */
import { test, expect } from '../../../support/fixtures.ts'
import { suppressAutoPrompts } from '../../../support/prompts.ts'
import { demoPhoneUser } from '../../support/demo-users.ts'
import { shot } from '../../support/shot.ts'

const PHONE = '01711223364'

test.describe('Feedback', () => {
  test('send feedback, thank-you state and history', async ({ browser, days }, testInfo) => {
    const context = await demoPhoneUser(browser, testInfo.project.use, PHONE)
    try {
      const res = await context.request.post('/api/profiles', {
        data: { name: 'Rina', relation: 'SELF', cycleLength: 28, periodLength: 5, lastPeriodStart: days.daysAgo(10), goal: 'tracking' },
      })
      expect(res.status()).toBe(201)
      const page = await context.newPage()
      await suppressAutoPrompts(page)

      await page.goto('/feedback')
      await expect(page.getByRole('heading', { level: 1, name: 'Feedback' })).toBeVisible()
      await expect(page.getByText('Please select a category to submit')).toBeVisible()
      await shot(page, 'fb-send')

      await page.getByRole('button', { name: 'Feature Request' }).click()
      await page.getByRole('button', { name: '4 stars' }).click()
      await page.getByLabel(/Message/).fill('Please add a reminder for the day before my period starts.')
      await shot(page, 'fb-send', { suffix: 'filled' })

      await page.getByRole('button', { name: 'Submit Feedback' }).click()
      await expect(page.getByText('Thank you for your feedback!')).toBeVisible()
      await shot(page, 'fb-send', { suffix: 'thanks' })

      // A second one with no message and no rating, to show what the history does with it.
      await page.goto('/feedback')
      await expect(page.getByText('Please select a category to submit')).toBeVisible()
      await page.getByRole('button', { name: 'Bug Report' }).click()
      await page.getByLabel(/Message/).fill('The calendar shows the wrong month after I switch profiles.')
      await page.getByRole('button', { name: 'Submit Feedback' }).click()
      await expect(page.getByText('Thank you for your feedback!')).toBeVisible()

      await page.reload()
      await expect(page.getByText('Your Previous Feedback')).toBeVisible()
      await expect(page.getByText('Please add a reminder for the day before my period starts.')).toBeVisible()
      await page.getByText('Your Previous Feedback').evaluate((el) => el.scrollIntoView({ block: 'start' }))
      await shot(page, 'fb-history')
    } finally {
      await context.close()
    }
  })

  test('empty history', async ({ browser }, testInfo) => {
    const context = await demoPhoneUser(browser, testInfo.project.use, '01711223365')
    try {
      const page = await context.newPage()
      await suppressAutoPrompts(page)
      await page.goto('/feedback')
      await expect(page.getByText('No feedback submitted yet — your input means a lot!')).toBeVisible()
      await page.getByText('Your Previous Feedback').evaluate((el) => el.scrollIntoView({ block: 'start' }))
      await shot(page, 'fb-history', { suffix: 'empty' })
    } finally {
      await context.close()
    }
  })
})
