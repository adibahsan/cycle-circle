import { test, expect } from '../../support/fixtures.ts'

test.describe('In-App Feedback', () => {
  test('submit feedback and verify it appears in feedback history after reload', async ({ newUser }) => {
    const { page } = await newUser()
    await page.goto('/feedback')

    await expect(page.getByRole('heading', { level: 1, name: 'Feedback' })).toBeVisible()
    await expect(page.getByText('No feedback submitted yet — your input means a lot!')).toBeVisible()

    // Select category: Feature Request
    await page.getByRole('button', { name: 'Feature Request' }).click()

    // Select 5-star rating
    await page.getByRole('button', { name: '5 stars' }).click()

    // Type feedback message
    const feedbackMsg = `E2E automated test feedback ${Date.now()}`
    await page.getByLabel(/Message/).fill(feedbackMsg)

    // Submit
    await page.getByRole('button', { name: 'Submit Feedback' }).click()

    // Verify submission confirmation
    await expect(page.getByText('Thank you for your feedback!')).toBeVisible()

    // Reload and check history
    await page.reload()
    await expect(page.getByText(feedbackMsg)).toBeVisible()
    await expect(page.getByText('Feature', { exact: true })).toBeVisible()
  })
})
