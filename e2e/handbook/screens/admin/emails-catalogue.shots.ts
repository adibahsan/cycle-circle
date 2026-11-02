/**
 * Handbook chapter "Emails catalogue" (docs/handbook/chapters/emails-catalogue.md), ticket #249.
 * Samples come from the Admin template preview (period, fertile, logging) and from email detail pages.
 */
import { test, expect } from '../../../support/fixtures.ts'
import { ADMIN_STATE, seedDemoMembers } from '../../support/admin-demo.ts'
import { DEMO_EMAIL_IDS, seedDemoEmails } from '../../support/automatic-demo.ts'
import { shot } from '../../support/shot.ts'

test.use({ storageState: ADMIN_STATE })

test.describe('Emails catalogue', () => {
  test.beforeAll(async ({ db }) => {
    await seedDemoMembers(db)
    await seedDemoEmails(db)
  })

  test('email log', async ({ page }) => {
    await page.goto('/emails?pageSize=100&search=example.test')
    await expect(page.getByRole('heading', { name: 'Email Logs' })).toBeVisible()
    await expect(page.getByText('owner@example.test')).toBeVisible()
    await shot(page, 'ec-overview')
  })

  for (const [label, anchor] of [
    ['Period Alert', 'ec-period-alert'],
    ['Fertile Window', 'ec-fertile-window'],
    ['Logging Reminder', 'ec-logging-reminder'],
  ] as const) {
    test(`template preview: ${label}`, async ({ page }) => {
      await page.goto('/emails/preview')
      await page.getByLabel('Template').selectOption({ label })
      await expect(page.getByRole('heading', { name: `Preview — ${label}` })).toBeVisible()
      await expect(page.frameLocator('iframe').getByText('Cycle Circle').first()).toBeVisible()
      await page.getByRole('heading', { name: /^Preview/ }).evaluate((el) => el.scrollIntoView({ block: 'start' }))
      await shot(page, anchor)
    })
  }

  for (const [key, anchor] of [
    ['magicLink', 'ec-magic-link'],
    ['verification', 'ec-verification-code'],
    ['completion', 'ec-profile-completion'],
    ['report', 'ec-reports'],
  ] as const) {
    test(`email detail: ${anchor}`, async ({ page }) => {
      await page.goto(`/emails/${DEMO_EMAIL_IDS[key]}`)
      await expect(page.getByRole('heading', { name: 'Email Preview' })).toBeVisible()
      await expect(page.getByText('Generating preview…')).toHaveCount(0)
      await page.getByRole('heading', { name: 'Rendered preview' }).evaluate((el) => el.scrollIntoView({ block: 'start' }))
      await shot(page, anchor)
    })
  }
})
