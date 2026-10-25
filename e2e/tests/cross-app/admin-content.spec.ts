/**
 * #128 — Admin content authoring, checked on web (A10 / A11).
 * Titles are prefixed `E2E128` so they never collide with #124 web-content specs.
 */
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import type { Locator, Page } from '@playwright/test'
import { test, expect } from '../../support/fixtures'
import { createLoggedInAdmin } from '../../support/admin'

const FIXTURE_PNG = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../fixtures/article-red-1x1.png',
)

function uniqueId(): string {
  return randomBytes(4).toString('hex')
}

async function fillEditor(editor: Locator, text: string) {
  await editor.click()
  await editor.fill(text)
}

async function pasteHtmlIntoEditor(page: Page, editor: Locator, html: string) {
  await editor.click()
  await page.evaluate((payload) => {
    const el = document.activeElement
    if (!(el instanceof HTMLElement)) throw new Error('no focused editor')
    const dt = new DataTransfer()
    dt.setData('text/html', payload)
    dt.setData('text/plain', 'unsafe-fallback')
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    )
  }, html)
}

async function switchWebLanguage(page: Page) {
  const toggle = page.getByRole('button', { name: 'Switch language' })
  if (!(await toggle.isVisible())) {
    await page.getByRole('button', { name: 'More' }).click()
    await expect(toggle).toBeVisible()
  }
  await toggle.click()
}

test.describe('Admin content authoring (seen on web)', () => {
  test('draft stays off web; publish shows under phase in English and Bengali with image', async ({
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
    const runId = uniqueId()
    const titleEn = `E2E128 Follicular ${runId}`
    const titleBn = `ই২ই১২৮ ফলিকুলার ${runId}`
    const bodyEnMarker = `E2E128 EN body ${runId}`
    const bodyBnMarker = `ই২ই১২৮ বাংলা মূল ${runId}`

    const admin = await createLoggedInAdmin(browser, {
      viewport,
      userAgent,
      isMobile,
      hasTouch,
      deviceScaleFactor,
      locale,
      timezoneId,
    })
    const web = await newUser()

    try {
      const { page: adminPage } = admin

      // ── Create bilingual draft with phase + image ──────────────────────────
      await adminPage.goto('/content/new')
      await expect(adminPage.getByRole('heading', { name: 'New Article' })).toBeVisible()

      await adminPage.getByLabel('English Title').fill(titleEn)
      await adminPage.getByLabel('Bengali Title').fill(titleBn)

      const editors = adminPage.locator('.ProseMirror')
      await expect(editors).toHaveCount(2)
      await fillEditor(editors.nth(0), bodyEnMarker)
      await fillEditor(editors.nth(1), bodyBnMarker)

      await adminPage.getByLabel('Choose an image to insert').first().setInputFiles(FIXTURE_PNG)
      await expect(editors.nth(0).locator('img[src^="/uploads/"]')).toBeVisible({ timeout: 15_000 })

      await adminPage.getByRole('checkbox', { name: 'Follicular' }).check()
      await expect(adminPage.getByRole('button', { name: 'Draft' })).toBeVisible()
      await adminPage.getByRole('button', { name: 'Save Article' }).first().click()
      await adminPage.waitForURL((url) => url.pathname === '/content')
      await expect(adminPage.getByRole('heading', { name: 'Content' })).toBeVisible()
      await expect(adminPage.getByText(titleEn)).toBeVisible()

      // ── Draft must not appear on web ───────────────────────────────────────
      await web.page.goto('/content')
      await expect(web.page.getByRole('heading', { name: 'Health Articles' })).toBeVisible()
      await expect(web.page.getByRole('button', { name: titleEn })).toHaveCount(0)
      await expect(web.page.getByText(titleEn)).toHaveCount(0)

      // ── Publish the same article ───────────────────────────────────────────
      // FilterBar debounces client search. Open via the row (same as onRowClick → /content/[id]);
      // on phone the sticky pagination bar can intercept the tiny Edit pencil.
      await adminPage.getByRole('searchbox', { name: 'Search' }).fill(titleEn)
      const draftRow = adminPage.getByRole('button', { name: titleEn })
      await expect(draftRow).toBeVisible({ timeout: 5_000 })
      await draftRow.click({ force: true })
      await expect(adminPage.getByRole('heading', { name: 'Edit Article' })).toBeVisible()

      await adminPage.getByRole('button', { name: 'Published' }).click()
      await adminPage.getByRole('button', { name: 'Save Changes' }).first().click()
      // Full bilingual + phases → no publish-anyway modal
      await adminPage.waitForURL((url) => url.pathname === '/content')
      await expect(adminPage.getByText(titleEn)).toBeVisible()

      // ── Published: visible under Follicular, EN then BN ────────────────────
      await web.page.goto('/content?phase=FOLLICULAR')
      await expect(web.page.getByRole('button', { name: titleEn })).toBeVisible({ timeout: 15_000 })

      // Wrong phase filter hides it
      await web.page.getByRole('button', { name: 'Menstrual' }).click()
      await expect(web.page).toHaveURL(/phase=MENSTRUAL/)
      await expect(web.page.getByRole('button', { name: titleEn })).toHaveCount(0)

      await web.page.getByRole('button', { name: 'Follicular' }).click()
      await expect(web.page).toHaveURL(/phase=FOLLICULAR/)
      await web.page.getByRole('button', { name: titleEn }).click()
      await expect(web.page.getByRole('heading', { name: titleEn })).toBeVisible()
      await expect(web.page.getByText(bodyEnMarker)).toBeVisible({ timeout: 15_000 })
      await expect(web.page.locator('article img[src^="/uploads/"]')).toBeVisible()

      await switchWebLanguage(web.page)
      await expect(web.page.getByRole('heading', { name: titleBn })).toBeVisible()
      await expect(web.page.getByText(bodyBnMarker)).toBeVisible()
    } finally {
      await admin.context.close()
    }
  })

  test('unsafe HTML pasted in the editor is removed before it reaches web', async ({
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
    const runId = uniqueId()
    const titleEn = `E2E128 Sanitize ${runId}`
    const titleBn = `ই২ই১২৮ স্যানিটাইজ ${runId}`
    const safeMarker = `E2E128 safe-after-sanitize ${runId}`
    const unsafeHtml =
      `<p>${safeMarker}</p>` +
      `<script>window.__e2e128xss=1</script>` +
      `<img src="https://evil.example/xss-${runId}.png" onerror="window.__e2e128xss=1">` +
      `<iframe src="https://evil.example/frame-${runId}"></iframe>`

    const admin = await createLoggedInAdmin(browser, {
      viewport,
      userAgent,
      isMobile,
      hasTouch,
      deviceScaleFactor,
      locale,
      timezoneId,
    })
    const web = await newUser()

    try {
      const { page: adminPage } = admin
      await adminPage.goto('/content/new')
      await adminPage.getByLabel('English Title').fill(titleEn)
      await adminPage.getByLabel('Bengali Title').fill(titleBn)

      const editors = adminPage.locator('.ProseMirror')
      await expect(editors).toHaveCount(2)
      await pasteHtmlIntoEditor(adminPage, editors.nth(0), unsafeHtml)
      await expect(editors.nth(0).getByText(safeMarker)).toBeVisible()
      // BN body required to avoid publish-anyway modal
      await fillEditor(editors.nth(1), `ই২ই১২৮ bn ${runId}`)

      await adminPage.getByRole('checkbox', { name: 'Luteal' }).check()
      await adminPage.getByRole('button', { name: 'Published' }).click()
      await adminPage.getByRole('button', { name: 'Save Article' }).first().click()
      await adminPage.waitForURL((url) => url.pathname === '/content')

      await web.page.goto('/content?phase=LUTEAL')
      await expect(web.page.getByRole('button', { name: titleEn })).toBeVisible({ timeout: 15_000 })
      await web.page.getByRole('button', { name: titleEn }).click()
      await expect(web.page.getByText(safeMarker)).toBeVisible({ timeout: 15_000 })

      const reader = web.page.locator('article')
      await expect(reader.locator('script')).toHaveCount(0)
      await expect(reader.locator('iframe')).toHaveCount(0)
      await expect(reader.locator('img[src*="evil.example"]')).toHaveCount(0)
      await expect(reader.locator('[onerror]')).toHaveCount(0)

      const xssFlag = await web.page.evaluate(() => (window as unknown as { __e2e128xss?: number }).__e2e128xss)
      expect(xssFlag).toBeUndefined()
      await expect(web.page.locator('body')).not.toContainText('evil.example')
    } finally {
      await admin.context.close()
    }
  })
})
