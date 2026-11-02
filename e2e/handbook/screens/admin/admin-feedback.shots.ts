/**
 * Handbook chapter "Feedback" (Admin) (docs/handbook/chapters/admin-feedback.md), ticket #246.
 * The feedback is demo text written for the handbook, sent by the seeded demo members.
 */
import { test, expect } from '../../../support/fixtures.ts'
import { refreshData } from '../../../support/admin-charts.ts'
import { ADMIN_STATE, seedDemoMembers } from '../../support/admin-demo.ts'
import { shot } from '../../support/shot.ts'
import { demoNowMs } from '../../support/demo-clock.ts'

test.use({ storageState: ADMIN_STATE })

const DAY = 24 * 60 * 60 * 1000
const ITEMS: Array<[string, 'BUG' | 'FEATURE' | 'GENERAL' | 'SATISFACTION', number | null, string]> = [
  ['hbdemo-02', 'BUG', 2, 'The calendar did not show my last period after I saved it. I had to reopen the app.'],
  ['hbdemo-03', 'FEATURE', 4, 'Please add a weekly summary of my symptoms.'],
  ['hbdemo-04', 'SATISFACTION', 5, 'I love the predictions, they were right this month.'],
  ['hbdemo-05', 'GENERAL', null, 'No message'],
  ['hbdemo-07', 'FEATURE', 3, 'It would help to export my logs so I can show my doctor. A printable page with the last six cycles would be perfect, including the symptoms I noted on each day.'],
  ['hbdemo-09', 'BUG', 1, 'I could not log in with my phone number this morning.'],
  ['hbdemo-10', 'SATISFACTION', 4, 'Simple and easy to use.'],
]

test.describe('Admin Feedback', () => {
  test.beforeAll(async ({ db }) => {
    await seedDemoMembers(db)
    const now = demoNowMs()
    await db.feedback.createMany({
      data: ITEMS.map(([userId, category, rating, message], i) => ({
        id: `hbac-fb-${i}`, userId, category, rating, message, createdAt: new Date(now - (i * 2 + 1) * DAY - i * 3_600_000),
      })),
      skipDuplicates: true,
    })
  })

  test('inbox, detail and CSV export', async ({ page }) => {
    await page.goto('/feedback')
    await expect(page.getByRole('heading', { name: 'Feedback', exact: true })).toBeVisible()
    await refreshData(page)
    await expect(page.getByText('Please add a weekly summary of my symptoms.').first()).toBeVisible()
    await shot(page, 'af-inbox')

    await page.getByRole('heading', { name: 'Feedback', exact: true }).evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await shot(page, 'af-export')

    await page.getByText('I could not log in with my phone number this morning.').first().click()
    await expect(page).toHaveURL(/\/feedback\/.+/)
    await expect(page.getByText('Back to feedback')).toBeVisible()
    await shot(page, 'af-detail')
  })
})
