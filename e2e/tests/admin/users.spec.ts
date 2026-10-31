import { randomBytes } from 'node:crypto'
import { test, expect } from '../../support/fixtures'
import { fillSearch } from '../../support/search.ts'
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

/** Wait until FilterBar's debounced search (and optional status) have landed in the URL. */
async function expectUsersFilterUrl(
  page: import('@playwright/test').Page,
  opts: { search: string; status?: string },
  timeout?: number,
) {
  await expect(page).toHaveURL((url) => {
    const params = url.searchParams
    if (params.get('search') !== opts.search) return false
    if (opts.status !== undefined && params.get('status') !== opts.status) return false
    return true
  }, { timeout })
}

test.describe('Admin users', () => {
  test('search narrows the list to matching users', async ({
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
    // Unique prefix per test so unstable_cache keys don't collide across desktop/phone workers.
    const runId = randomBytes(3).toString('hex')
    const hit = await newUser()
    const miss = await newUser()
    const hitStored = toDbPhone(hit.phone)
    const missStored = toDbPhone(miss.phone)
    const hitMarker = `E2E Srch ${runId} Hit`
    const missMarker = `E2E Srch ${runId} Miss`
    const sharedPrefix = `E2E Srch ${runId}`
    await e2eDb().user.update({ where: { phone: hitStored }, data: { fullName: hitMarker } })
    await e2eDb().user.update({ where: { phone: missStored }, data: { fullName: missMarker } })

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
      await page.goto('/users?pageSize=100&status=active')
      await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
      await page.getByRole('button', { name: 'Refresh data' }).click()

      // FilterBar debounces search → URL; wait for each push before the next fill
      // so a late emit cannot race the following interaction (see status-filter test).
      await fillSearch(page.getByRole('searchbox', { name: 'Search' }), sharedPrefix, (timeout) => expectUsersFilterUrl(page, { search: sharedPrefix }, timeout))
      await expect(page.getByText(hitMarker)).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(missMarker)).toBeVisible()

      // Full marker: only the match remains.
      await fillSearch(page.getByRole('searchbox', { name: 'Search' }), hitMarker, (timeout) => expectUsersFilterUrl(page, { search: hitMarker }, timeout))
      await expect(page.getByText(hitMarker)).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(missMarker)).toHaveCount(0)
      await expect(page.getByText(hitStored)).toBeVisible()
    } finally {
      await admin.context.close()
    }
  })

  test('status filter Suspended shows suspended users and hides active ones', async ({
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
    const suspended = await newUser()
    const active = await newUser()
    const suspendedStored = toDbPhone(suspended.phone)
    const activeStored = toDbPhone(active.phone)
    const suspendedMarker = `E2E St ${runId} Sus`
    const activeMarker = `E2E St ${runId} Act`
    const sharedPrefix = `E2E St ${runId}`

    // Suspend before the first /users load so the filter is not racing a mid-test DB write.
    await e2eDb().user.update({
      where: { phone: suspendedStored },
      data: { fullName: suspendedMarker, suspendedAt: new Date() },
    })
    await e2eDb().user.update({
      where: { phone: activeStored },
      data: { fullName: activeMarker },
    })

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
      await page.goto('/users?pageSize=100&status=active')
      await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
      await page.getByRole('button', { name: 'Refresh data' }).click()

      // Default Status=Active: active visible, suspended hidden.
      // Must wait for the debounced search URL (not just row text): with pageSize=100 the
      // active marker can already be on-screen before FilterBar emits, and a late
      // updateParams({ search }) snapshots status=active and overwrites Suspended.
      await fillSearch(page.getByRole('searchbox', { name: 'Search' }), sharedPrefix, (timeout) => expectUsersFilterUrl(page, { search: sharedPrefix, status: 'active' }, timeout))
      await expect(page.getByText(activeMarker)).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(suspendedMarker)).toHaveCount(0)

      await page.getByRole('combobox', { name: 'Status:' }).click()
      await page.getByRole('option', { name: 'Suspended' }).click()
      await expectUsersFilterUrl(page, { search: sharedPrefix, status: 'suspended' })
      await page.getByRole('button', { name: 'Refresh data' }).click()
      await expect(page.getByText(suspendedMarker)).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(activeMarker)).toHaveCount(0)
      // The table row is a clickable role=button whose name holds every cell.
      await expect(
        page.getByRole('button').filter({ has: page.getByText(suspendedMarker) }).getByText('Suspended'),
      ).toBeVisible()
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
      await fillSearch(page.getByRole('searchbox', { name: 'Search' }), marker, (timeout) => expectUsersFilterUrl(page, { search: marker }, timeout))
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
  // Regression for #134: handleExport passes the active filters to exportUsersCsv.
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
      await fillSearch(page.getByRole('searchbox', { name: 'Search' }), markerA, (timeout) => expectUsersFilterUrl(page, { search: markerA }, timeout))
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

test.describe('Server render', () => {
  test('user detail hydrates when its dates fall on different days in UTC and Bangladesh', async ({
    browser,
    newUser,
    days,
    viewport,
  }) => {
    // The admin server runs at UTC and the browser at Asia/Dhaka. 18:00Z is 00:00 Bangladesh,
    // so a date formatted in the process timezone differs between server and client (React #418)
    // and the first click after load is lost.
    const u = await newUser()
    const row = await e2eDb().user.update({
      where: { phone: toDbPhone(u.phone) },
      data: { deletedAt: days.startOf(days.daysAgo(29)) },
    })
    const admin = await createLoggedInAdmin(browser, { viewport })
    const reactErrors: string[] = []
    admin.page.on('pageerror', (e) => {
      if (/Minified React error #(418|423|425)|hydrat/i.test(e.message)) reactErrors.push(e.message)
    })
    try {
      await admin.page.goto(`/users/${row.id}`)
      await expect(admin.page.getByRole('button', { name: 'Restore', exact: true })).toBeVisible()
      await admin.page.waitForLoadState('networkidle')
      expect(reactErrors).toEqual([])
    } finally {
      await admin.context.close()
    }
  })

  test("an admin's own detail page has no Suspend or Delete", async ({ browser, viewport }) => {
    const admin = await createLoggedInAdmin(browser, { viewport })
    try {
      await admin.page.goto(`/users/${admin.id}`)
      await expect(admin.page.getByRole('heading', { name: 'E2E Admin', exact: true })).toBeVisible()
      await expect(admin.page.getByRole('button', { name: 'Suspend', exact: true })).toHaveCount(0)
      await expect(admin.page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0)
    } finally {
      await admin.context.close()
    }
  })

  // The (admin) segment streams behind loading.tsx, so the status line is already 200 when
  // notFound() runs (same as every other admin detail page). What matters: the not-found
  // page renders, not the error boundary.
  test('an unknown user id shows the not-found page', async ({ browser, viewport }) => {
    const admin = await createLoggedInAdmin(browser, { viewport })
    try {
      await admin.page.goto('/users/does-not-exist')
      await expect(admin.page.getByRole('heading', { name: 'This page could not be found.' })).toBeVisible()
      await expect(admin.page.getByText('Something went wrong')).toHaveCount(0)
    } finally {
      await admin.context.close()
    }
  })
})
