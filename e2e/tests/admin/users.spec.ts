import { test, expect } from '../../support/fixtures'
import { createLoggedInAdmin } from '../../support/admin'
import { e2eDb } from '../../support/db'
import { toDbPhone } from '../../support/users'

async function downloadText(download: import('@playwright/test').Download): Promise<string> {
  const stream = await download.createReadStream()
  if (!stream) throw new Error('download stream missing')
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

test.describe('Admin users', () => {
  test('search and status filter narrow the list to matching users', async ({
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
    const { phone } = await newUser()
    const stored = toDbPhone(phone)
    const marker = `E2E Filter ${phone.slice(-6)}`
    await e2eDb().user.update({ where: { phone: stored }, data: { fullName: marker } })

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
      const { page } = admin
      await page.goto('/users')
      await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()

      await page.getByRole('searchbox', { name: 'Search' }).fill(marker)
      await expect(page.getByText(marker)).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(stored)).toBeVisible()

      // Suspend the throwaway user, then filter Status → Suspended.
      // (Users table rows use role=button when clickable, so assert via text + ancestor.)
      await e2eDb().user.update({ where: { phone: stored }, data: { suspendedAt: new Date() } })
      await page.getByRole('combobox', { name: /Status/ }).click()
      await page.getByRole('option', { name: 'Suspended' }).click()
      await expect(page).toHaveURL(/status=suspended/)
      await expect(page.getByText(marker)).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(marker).locator('xpath=ancestor::tr[1]').getByText('Suspended')).toBeVisible()
    } finally {
      await admin.context.close()
    }
  })

  test('users CSV export contains the filtered user', async ({
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
    const { phone } = await newUser()
    const stored = toDbPhone(phone)
    const marker = `E2E Export ${phone.slice(-6)}`
    await e2eDb().user.update({ where: { phone: stored }, data: { fullName: marker } })

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
      const { page } = admin
      await page.goto('/users')
      await page.getByRole('searchbox', { name: 'Search' }).fill(marker)
      await expect(page.getByText(marker)).toBeVisible({ timeout: 15_000 })

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Export CSV' }).click(),
      ])
      const csv = await downloadText(download)
      expect(csv).toContain(marker)
      expect(csv).toContain(stored)
    } finally {
      await admin.context.close()
    }
  })

  // Spec story 67 / #126: export must contain *the filtered users* only.
  // handleExport calls exportUsersCsv() with no filter args — see #134.
  test('users CSV export excludes users outside the active search filter', async ({
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
    test.fail(true, 'https://github.com/adibahsan/cycle-circle/issues/134')

    const userA = await newUser()
    const userB = await newUser()
    const storedA = toDbPhone(userA.phone)
    const storedB = toDbPhone(userB.phone)
    const markerA = `E2E CsvA ${userA.phone.slice(-6)}`
    const markerB = `E2E CsvB ${userB.phone.slice(-6)}`
    await e2eDb().user.update({ where: { phone: storedA }, data: { fullName: markerA } })
    await e2eDb().user.update({ where: { phone: storedB }, data: { fullName: markerB } })

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
      const { page } = admin
      await page.goto('/users')
      await page.getByRole('searchbox', { name: 'Search' }).fill(markerA)
      await expect(page.getByText(markerA)).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(markerB)).toHaveCount(0)

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Export CSV' }).click(),
      ])
      const csv = await downloadText(download)
      expect(csv).toContain(markerA)
      expect(csv).toContain(storedA)
      expect(csv).not.toContain(markerB)
      expect(csv).not.toContain(storedB)
    } finally {
      await admin.context.close()
    }
  })
})
