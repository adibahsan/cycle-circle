import { randomBytes } from 'node:crypto'
import { test, expect } from '../../support/fixtures'
import { fillSearch } from '../../support/search.ts'
import { openDialog } from '../../support/dialogs.ts'
import { createLoggedInAdmin } from '../../support/admin'
import { e2eDb } from '../../support/db'
import { toDbPhone } from '../../support/users'

async function expectAuditLogFilterUrl(
  page: import('@playwright/test').Page,
  opts: { search?: string; action?: string; targetType?: string },
  timeout?: number,
) {
  await expect(page).toHaveURL((url) => {
    const params = url.searchParams
    if (opts.search !== undefined && params.get('search') !== opts.search) return false
    if (opts.action !== undefined && params.get('action') !== opts.action) return false
    if (opts.targetType !== undefined && params.get('targetType') !== opts.targetType) return false
    return true
  }, { timeout })
}

test.describe('Admin audit logs', () => {
  test('admin actions taken in the run show up in the audit log search', async ({
    browser,
    newUser,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    const runId = randomBytes(3).toString('hex')
    const user = await newUser()
    const dbUser = await e2eDb().user.findUniqueOrThrow({ where: { phone: toDbPhone(user.phone) } })

    const admin = await createLoggedInAdmin(browser, {
      viewport,
      userAgent,
      isMobile,
      hasTouch,
      deviceScaleFactor,
      locale,
      timezoneId,
    })

    const markerNote = `reason-${runId}`

    try {
      const { page } = admin
      // A real admin action: suspend the throwaway user from the user detail page.
      await page.goto(`/users/${dbUser.id}`)
      const dialog = await openDialog(page.getByRole('button', { name: 'Suspend' }), page.getByRole('dialog'))
      await dialog.getByLabel(/Reason/).fill(markerNote)
      await dialog.getByRole('button', { name: 'Suspend', exact: true }).click()
      await expect(page.getByText(/Suspended on/)).toBeVisible({ timeout: 15_000 })

      await page.goto('/audit-logs?pageSize=100')
      await expect(page.getByRole('heading', { name: 'Audit Logs' })).toBeVisible()

      // Debounced search for the specific target ID
      await fillSearch(page.getByRole('searchbox', { name: 'Search' }), dbUser.id, (timeout) => expectAuditLogFilterUrl(page, { search: dbUser.id }, timeout))

      // Verify the matching row appears
      const row = page.getByRole('row').filter({ hasText: 'USER SUSPENDED' })
      await expect(row).toBeVisible({ timeout: 15_000 })
      await expect(row.getByRole('cell', { name: 'User', exact: true })).toBeVisible()
      await expect(row.getByText('E2E Admin')).toBeVisible()

      // Expand metadata
      const metaButton = row.getByRole('button', { name: /metadata/i })
      await metaButton.click()
      await expect(row.getByText(markerNote)).toBeVisible()
    } finally {
      await admin.context.close()
    }
  })

  test('the Action filter finds a recorded suspension', async ({
    browser,
    newUser,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    const user = await newUser()
    const dbUser = await e2eDb().user.findUniqueOrThrow({ where: { phone: toDbPhone(user.phone) } })
    const admin = await createLoggedInAdmin(browser, {
      viewport,
      userAgent,
      isMobile,
      hasTouch,
      deviceScaleFactor,
      locale,
      timezoneId,
    })
    try {
      await e2eDb().adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: 'USER_SUSPENDED',
          targetType: 'User',
          targetId: dbUser.id,
          metadata: { reason: 'filter check' },
        },
      })
      const { page } = admin
      await page.goto('/audit-logs?pageSize=100')
      await fillSearch(page.getByRole('searchbox', { name: 'Search' }), dbUser.id, (timeout) => expectAuditLogFilterUrl(page, { search: dbUser.id }, timeout))
      await page.getByRole('combobox', { name: 'Action:' }).click()
      await page.getByRole('option', { name: 'User Suspended', exact: true }).click()
      await expect(page).toHaveURL(/action=/)
      await expect(
        page.getByRole('row').filter({ hasText: 'USER SUSPENDED' }),
      ).toBeVisible({ timeout: 5_000 })
    } finally {
      await admin.context.close()
    }
  })
})
