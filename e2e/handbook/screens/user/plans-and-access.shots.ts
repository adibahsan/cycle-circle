/**
 * Handbook chapter "Plans & access" (docs/handbook/chapters/plans-and-access.md), ticket #240.
 * Anchors and file names come from docs/handbook/OUTLINE.md; `shot()` refuses anything else.
 */
import { test, expect } from '../../../support/fixtures.ts'
import { ensureUserProfile, findUserByPhone, revalidateWebTags, setUserSubscription } from '../../../support/db.ts'
import { statePath } from '../../../support/personas.ts'
import { suppressAutoPrompts } from '../../../support/prompts.ts'
import { demoEmailTrialUser, demoPhoneUser } from '../../support/demo-users.ts'
import { shot } from '../../support/shot.ts'

/** Fixed fake numbers for this chapter's demo Users (not used by other handbook files). */
const PHONES = { free: '01711223366', lapsed: '01711223388', granted: '01711223311' } as const

test.describe('Plans & access', () => {
  test('Free phone User: plans at a glance and the Free vs Pro table', async ({ browser }, testInfo) => {
    const context = await demoPhoneUser(browser, testInfo.project.use, PHONES.free)
    try {
      await ensureUserProfile(PHONES.free, { name: 'Rina' })
      const user = await findUserByPhone(PHONES.free)
      await setUserSubscription({ userId: user!.id, status: 'FREE' })
      const page = await context.newPage()
      await suppressAutoPrompts(page)
      await page.goto('/subscription')
      await expect(page.getByText('Cycle Circle Free', { exact: true })).toBeVisible()
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Go Pro')
      await shot(page, 'pa-at-a-glance')

      const table = page.getByRole('table', { name: 'Free vs Pro' })
      await page.getByRole('heading', { name: 'Free vs Pro' }).evaluate((el) => el.scrollIntoView({ block: 'start' }))
      await expect(table.getByRole('row', { name: /^SMS Alerts/ })).toBeVisible()
      await shot(page, 'pa-pro-gating')
    } finally {
      await context.close()
    }
  })

  test('email trial: pill, Subscription page and the keep-account dialog', async ({ browser }, testInfo) => {
    const context = await demoEmailTrialUser(browser, testInfo.project.use, 'rina.plans@example.com')
    try {
      const page = await context.newPage()
      await suppressAutoPrompts(page)
      await page.goto('/dashboard')
      const pill = page.getByRole('button', { name: /Trial ends in/ }).filter({ visible: true }).first()
      await expect(pill).toBeVisible()
      await shot(page, 'pa-email-trial')

      await page.goto('/subscription')
      await expect(page.getByText(/Trial · \d+h remaining/)).toBeVisible()
      await shot(page, 'pa-email-trial', { suffix: 'subscription' })

      await page.goto('/dashboard')
      await pill.click()
      await expect(page.getByRole('heading', { name: 'Keep your account' })).toBeVisible()
      await shot(page, 'pa-keep-account')
    } finally {
      await context.close()
    }
  })

  test('trial lock after 24 hours', async ({ browser, db }, testInfo) => {
    const email = 'rina.locked@example.com'
    const context = await demoEmailTrialUser(browser, testInfo.project.use, email)
    try {
      const user = await db.user.update({ where: { email }, data: { emailTrialExpiresAt: new Date(Date.now() - 60 * 60 * 1000) } })
      // The Subscription page reads the User from a 5-minute cache; the lock itself reads live status.
      await revalidateWebTags([`user:${user.id}`])
      const page = await context.newPage()
      await page.goto('/dashboard')
      const lock = page.getByRole('dialog', { name: /trial has ended/i })
      await expect(lock).toBeVisible({ timeout: 20_000 })
      await shot(page, 'pa-trial-lock')

      await lock.getByRole('link', { name: 'Upgrade to Pro' }).click()
      await expect(page).toHaveURL(/\/subscription/)
      await expect(page.getByText('Your free trial has ended — upgrade to continue.')).toBeVisible()
      await shot(page, 'pa-trial-lock', { suffix: 'subscription' })
    } finally {
      await context.close()
    }
  })

  test('lapsed plan', async ({ browser }, testInfo) => {
    const context = await demoPhoneUser(browser, testInfo.project.use, PHONES.lapsed)
    try {
      await ensureUserProfile(PHONES.lapsed, { name: 'Rina' })
      const user = await findUserByPhone(PHONES.lapsed)
      await setUserSubscription({ userId: user!.id, status: 'LAPSED' })
      const page = await context.newPage()
      await suppressAutoPrompts(page)
      await page.goto('/subscription')
      await expect(page.getByText('Your subscription has expired. Renew to keep Pro.')).toBeVisible()
      await shot(page, 'pa-lapsed')
    } finally {
      await context.close()
    }
  })

  test('Admin-granted Pro cannot be cancelled by the User', async ({ browser }, testInfo) => {
    const context = await demoPhoneUser(browser, testInfo.project.use, PHONES.granted)
    try {
      await ensureUserProfile(PHONES.granted, { name: 'Rina' })
      const user = await findUserByPhone(PHONES.granted)
      await setUserSubscription({ userId: user!.id, status: 'PRO', adminOverride: true })
      const page = await context.newPage()
      await suppressAutoPrompts(page)
      await page.goto('/subscription')
      await page.getByRole('button', { name: 'Unsubscribe from Pro' }).click()
      await page.getByRole('dialog', { name: 'Unsubscribe from Pro?' }).getByRole('button', { name: 'Unsubscribe', exact: true }).click()
      await expect(page.getByText("Your Pro access was granted by our team, so it can't be cancelled here. Contact support.")).toBeVisible()
      await shot(page, 'pa-admin-overrides')
    } finally {
      await context.close()
    }
  })
})

test.describe('Plans & access: seeded Users', () => {
  test.describe('Pro User', () => {
    test.use({ storageState: statePath('streaker') })
    test('Pro plan page', async ({ page }) => {
      await suppressAutoPrompts(page)
      await page.goto('/subscription')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your Pro plan')
      await shot(page, 'pa-pro')
    })
  })

})
