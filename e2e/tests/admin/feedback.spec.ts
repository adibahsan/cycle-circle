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

/** Wait until FilterBar's debounced search (and optional category) have landed in the URL. */
async function expectFeedbackFilterUrl(
  page: import('@playwright/test').Page,
  opts: { q?: string; category?: string },
  timeout?: number,
) {
  await expect(page).toHaveURL((url) => {
    const params = url.searchParams
    if (opts.q !== undefined && params.get('q') !== opts.q) return false
    if (opts.category !== undefined && params.get('category') !== opts.category) return false
    return true
  }, { timeout })
}

test.describe('Admin feedback', () => {
  test('filter feedback by search and category, and open detail view', async ({
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
    const userA = await newUser()
    const userB = await newUser()

    const phoneDbA = toDbPhone(userA.phone)
    const phoneDbB = toDbPhone(userB.phone)
    const dbUserA = await e2eDb().user.findUniqueOrThrow({ where: { phone: phoneDbA } })
    const dbUserB = await e2eDb().user.findUniqueOrThrow({ where: { phone: phoneDbB } })

    const sharedPrefix = `E2E FB ${runId}`
    const msgA = `${sharedPrefix} Bug report details`
    const msgB = `${sharedPrefix} Feature suggestion`

    const fbA = await e2eDb().feedback.create({
      data: {
        userId: dbUserA.id,
        category: 'BUG',
        message: msgA,
        rating: 5,
      },
    })
    await e2eDb().feedback.create({
      data: {
        userId: dbUserB.id,
        category: 'FEATURE',
        message: msgB,
        rating: 4,
      },
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
      await page.goto('/feedback?pageSize=100')
      await expect(page.getByRole('heading', { name: 'Feedback', exact: true })).toBeVisible()

      // Debounced search: both items match the shared prefix
      await fillSearch(page.getByRole('searchbox', { name: 'Search' }), sharedPrefix, (timeout) => expectFeedbackFilterUrl(page, { q: sharedPrefix }, timeout))
      await expect(page.getByText(msgA)).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(msgB)).toBeVisible()

      // Category filter: narrow to Bug Report only
      await page.getByRole('combobox', { name: 'Category:' }).click()
      await page.getByRole('option', { name: 'Bug Report' }).click()
      await expectFeedbackFilterUrl(page, { q: sharedPrefix, category: 'BUG' })

      await expect(page.getByText(msgA)).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(msgB)).toHaveCount(0)

      // Open detail view by clicking row
      await page.getByText(msgA).click()
      await expect(page).toHaveURL(new RegExp(`/feedback/${fbA.id}`))
      await expect(page.getByRole('heading', { name: 'Feedback', exact: true })).toBeVisible()
      await expect(page.getByText('Bug Report', { exact: true })).toBeVisible()
      await expect(page.getByText(msgA)).toBeVisible()
      await expect(page.getByRole('link', { name: 'Back to feedback' })).toBeVisible()
    } finally {
      await admin.context.close()
    }
  })

  test('feedback CSV export contains filtered feedback', async ({
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
    const marker = `E2E ExpFB ${runId}`

    await e2eDb().feedback.create({
      data: {
        userId: dbUser.id,
        category: 'BUG',
        message: marker,
        rating: 5,
      },
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
      await page.goto('/feedback')
      await fillSearch(page.getByRole('searchbox', { name: 'Search' }), marker, (timeout) => expectFeedbackFilterUrl(page, { q: marker }, timeout))
      await expect(page.getByText(marker)).toBeVisible({ timeout: 15_000 })

      // On phone the charts above keep re-laying out, so Playwright's actionability
      // check never settles; dispatch the click straight to the button.
      const exportButton = page.getByRole('button', { name: 'Export CSV' })
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        exportButton.dispatchEvent('click'),
      ])
      const csv = await downloadText(download)
      expect(csv).toContain(marker)
      expect(csv).toContain('BUG')
    } finally {
      await admin.context.close()
    }
  })
})

test.describe('Server render', () => {
  test('feedback detail hydrates when it was submitted between 18:00Z and 24:00Z', async ({
    browser,
    newUser,
    days,
    viewport,
  }) => {
    // 18:00Z is 00:00 Bangladesh: server (UTC) and browser (Asia/Dhaka) must print the same date.
    const u = await newUser()
    const dbUser = await e2eDb().user.findUniqueOrThrow({ where: { phone: toDbPhone(u.phone) } })
    const fb = await e2eDb().feedback.create({
      data: {
        userId: dbUser.id,
        category: 'BUG',
        message: `E2E FB hydrate ${randomBytes(3).toString('hex')}`,
        rating: 4,
        createdAt: days.startOf(days.daysAgo(3)),
      },
    })
    const admin = await createLoggedInAdmin(browser, { viewport })

    const reactErrors: string[] = []
    admin.page.on('pageerror', (e) => {
      if (/Minified React error #(418|423|425)|hydrat/i.test(e.message)) reactErrors.push(e.message)
    })
    try {
      await admin.page.goto(`/feedback/${fb.id}`)
      await expect(admin.page.getByRole('link', { name: 'Back to feedback' })).toBeVisible()
      await expect(admin.page.getByText(fb.message)).toBeVisible()
      await admin.page.waitForLoadState('networkidle')
      expect(reactErrors).toEqual([])
    } finally {
      await admin.context.close()
    }
  })
})
