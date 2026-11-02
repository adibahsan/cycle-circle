/**
 * Handbook chapter "Subscription" (docs/handbook/chapters/subscription.md), ticket #240.
 * Anchors and file names come from docs/handbook/OUTLINE.md; `shot()` refuses anything else.
 */
import { test, expect } from '../../../support/fixtures.ts'
import { ensureUserProfile, findUserByPhone, setUserSubscription } from '../../../support/db.ts'
import { statePath } from '../../../support/personas.ts'
import { suppressAutoPrompts } from '../../../support/prompts.ts'
import { demoPhoneUser } from '../../support/demo-users.ts'
import { shot } from '../../support/shot.ts'

const PHONES = { free: '01711223377', unsubscribe: '01711223399' } as const

test.describe('Subscription', () => {
  test.describe('Pro User', () => {
    test.use({ storageState: statePath('streaker') })
    test('status page for a Pro User', async ({ page }) => {
      await suppressAutoPrompts(page)
      await page.goto('/subscription')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your Pro plan')
      await expect(page.getByRole('button', { name: 'Unsubscribe from Pro' })).toBeVisible()
      await shot(page, 'sb-status')
    })
  })

  test('Free User: Pro price and the upgrade dialog', async ({ browser }, testInfo) => {
    const context = await demoPhoneUser(browser, testInfo.project.use, PHONES.free)
    try {
      await ensureUserProfile(PHONES.free, { name: 'Rina' })
      const user = await findUserByPhone(PHONES.free)
      await setUserSubscription({ userId: user!.id, status: 'FREE' })
      const page = await context.newPage()
      await suppressAutoPrompts(page)
      await page.goto('/subscription')
      await expect(page.getByText('Charged to your mobile balance via BDApps')).toBeVisible()
      await expect(page.getByText('৳5', { exact: true })).toBeVisible()
      await shot(page, 'sb-price')

      await page.getByRole('button', { name: 'Upgrade to Pro' }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByRole('heading', { name: 'Upgrade to Pro' })).toBeVisible()
      await expect(dialog.getByText(/will be deducted from your mobile balance every day/)).toBeVisible()
      await shot(page, 'sb-upgrade')
    } finally {
      await context.close()
    }
  })

  test('Pro User unsubscribes', async ({ browser }, testInfo) => {
    const context = await demoPhoneUser(browser, testInfo.project.use, PHONES.unsubscribe)
    try {
      await ensureUserProfile(PHONES.unsubscribe, { name: 'Rina' })
      const page = await context.newPage()
      await suppressAutoPrompts(page)
      await page.goto('/subscription')
      await page.getByRole('button', { name: 'Unsubscribe from Pro' }).click()
      const dialog = page.getByRole('dialog', { name: 'Unsubscribe from Pro?' })
      await expect(dialog).toBeVisible()
      await shot(page, 'sb-unsubscribe')

      await dialog.getByRole('button', { name: 'Unsubscribe', exact: true }).click()
      await expect(page.getByText("You're unsubscribed. You're now on the free plan.")).toBeVisible()
      await shot(page, 'sb-unsubscribe', { suffix: 'done' })
    } finally {
      await context.close()
    }
  })
})
