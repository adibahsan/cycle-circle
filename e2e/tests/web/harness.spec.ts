// Contract tests for the shared helpers later specs build on (README "Helpers").
import { test, expect } from '../../support/fixtures'

test.describe('Harness', () => {
  test('newUser gives a logged-in Pro user whose page uses the project viewport', async ({ newUser, viewport }) => {
    const { page, phone } = await newUser()
    expect(phone).toMatch(/^0136\d{7}$/)

    await page.goto('/onboarding')
    await expect(page.getByRole('heading', { name: 'Welcome to Cycle Circle' })).toBeVisible()
    expect(page.viewportSize()).toEqual(viewport)

    const status = await page.request.get('/api/auth/status')
    expect((await status.json()).user).toMatchObject({ subscriptionStatus: 'PRO' })
  })

  test('days.today is the Bangladesh day the Asia/Dhaka browser sees', async ({ page, days }) => {
    await page.goto('/login')
    const browserDay = await page.evaluate(() => new Date().toLocaleDateString('en-CA'))
    expect(days.today).toBe(browserDay)
    expect(days.daysAgo(1) < days.today && days.today < days.daysFromNow(1)).toBe(true)
    expect(days.startOf(days.today).toISOString()).toBe(new Date(`${days.today}T00:00:00+06:00`).toISOString())
  })
})
