/**
 * Handbook chapter "Access" (docs/handbook/chapters/admin-access.md), ticket #245.
 * Desktop Admin screens. Anchors and file names come from docs/handbook/OUTLINE.md.
 */
import { test, expect } from '../../../support/fixtures.ts'
import { createLoggedInAdmin, createNonAdminEmailUser, setAdminCookie, signAdminAudienceToken } from '../../../support/admin.ts'
import { refreshData } from '../../../support/admin-charts.ts'
import { ADMIN_STATE, seedDemoMembers } from '../../support/admin-demo.ts'
import { shot } from '../../support/shot.ts'

test.describe('Admin access', () => {
  test('sign in: form, field errors and wrong password', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Cycle Circle Admin' })).toBeVisible()
    await shot(page, 'aa-sign-in')

    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Enter your email address.')).toBeVisible()
    await shot(page, 'aa-sign-in', { suffix: 'field-errors' })

    await page.getByLabel('Email').fill('admin@vesta.health')
    await page.getByLabel('Password', { exact: true }).fill('not-the-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Invalid email or password')).toBeVisible()
    await shot(page, 'aa-sign-in', { suffix: 'wrong-password' })
  })

  test('forbidden screen for an account that is not an Admin', async ({ browser }, testInfo) => {
    const user = await createNonAdminEmailUser()
    const context = await browser.newContext(testInfo.project.use)
    await setAdminCookie(context, await signAdminAudienceToken({ sub: user.id, email: user.email, role: 'USER' }))
    const page = await context.newPage()
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Not an admin' })).toBeVisible()
    await shot(page, 'aa-forbidden')
    await context.close()
  })

  test.describe('signed in as the seeded Admin', () => {
    test.use({ storageState: ADMIN_STATE })

    test('navigation: sidebar and collapsed sidebar', async ({ page, db }) => {
      await seedDemoMembers(db)
      await page.goto('/')
      await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible()
      await expect(page.getByRole('navigation', { name: 'Admin navigation' })).toBeVisible()
      await refreshData(page)
      await shot(page, 'aa-navigation')

      await page.getByRole('button', { name: 'Collapse sidebar' }).click()
      await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
      await shot(page, 'aa-navigation', { suffix: 'collapsed' })
      await page.getByRole('button', { name: 'Expand sidebar' }).click()
    })
  })

  test('sign out ends the session', async ({ browser }, testInfo) => {
    // A throwaway Admin: Sign out blacklists the session, which must never be the shared seeded one.
    const admin = await createLoggedInAdmin(browser, testInfo.project.use)
    const { page } = admin
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible()
    const signOut = page.getByRole('button', { name: 'Sign out' })
    await expect(signOut).toBeVisible()
    await shot(page, 'aa-sign-out', { of: page.locator('aside') })
    await signOut.click()
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'Cycle Circle Admin' })).toBeVisible()
    await shot(page, 'aa-sign-out', { suffix: 'login-after' })
    await admin.context.close()
  })
})
