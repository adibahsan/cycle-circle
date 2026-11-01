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
import { e2eDb, revalidateWebArticles, createArticle } from '../../support/db'

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

/** Wait until /content (optionally filtered) has finished rendering list or empty state. */
async function expectWebContentListSettled(page: Page) {
  await expect(page.getByRole('heading', { name: 'Health Articles' })).toBeVisible()
  const empty = page.getByText('No articles yet')
  // Article cards are links to /content/<id> that contain an h3 title.
  const anyCard = page.getByRole('link').filter({ has: page.getByRole('heading', { level: 3 }) }).first()
  await expect(empty.or(anyCard)).toBeVisible({ timeout: 15_000 })
}

/**
 * Open a web Learn list and wait for a just-published article. Admin's publish busts web's
 * `articles` cache, but a list read already in flight from a parallel spec can write the old list
 * back into the cache right after (seen once in a full local run). If the card is missing, bust the
 * tag again the way admin does and reload; the first look still relies on admin's own revalidation.
 */
async function expectPublishedOnWeb(page: Page, path: string, title: string) {
  await page.goto(path)
  await expectWebContentListSettled(page)
  const card = page.getByRole('link', { name: title })
  await expect(async () => {
    if (!(await card.isVisible())) {
      await revalidateWebArticles()
      await page.reload()
      await expectWebContentListSettled(page)
    }
    await expect(card).toBeVisible({ timeout: 5_000 })
  }).toPass({ timeout: 30_000 })
}

async function expectImgLoaded(img: Locator) {
  await expect(img).toBeVisible({ timeout: 15_000 })
  await expect
    .poll(async () => img.evaluate((el) => {
      const node = el as HTMLImageElement
      return node.complete && node.naturalWidth > 0
    }))
    .toBe(true)
}

/**
 * Open an admin content row by title. Scroll into view; do not use force
 * (force would hide a sticky-pagination overlap bug on phone).
 */
async function openAdminArticleRow(page: Page, title: string) {
  await page.getByRole('searchbox', { name: 'Search' }).fill(title)
  const row = page.getByRole('button', { name: title })
  await expect(row).toBeVisible({ timeout: 5_000 })
  await row.scrollIntoViewIfNeeded()
  await row.click()
}

function buildSanitizePayload(opts: {
  safeMarker: string
  runId: string
  uploadSrc: string
}): string {
  const { safeMarker, runId, uploadSrc } = opts
  return (
    `<p>${safeMarker}</p>` +
    `<p><strong>bold-${runId}</strong> <em>italic-${runId}</em></p>` +
    `<p><a href="https://example.com/safe-${runId}">safe link ${runId}</a></p>` +
    `<p><a href="javascript:alert(${runId})">js link</a></p>` +
    `<p style="background:red" onclick="window.__e2e128xss=1">styled click</p>` +
    `<style>.e2e128-evil-${runId}{display:none}</style>` +
    `<script>window.__e2e128xss=1</script>` +
    `<img src="https://evil.example/xss-${runId}.png" onerror="window.__e2e128xss=1" alt="evil">` +
    `<iframe src="https://evil.example/frame-${runId}"></iframe>` +
    `<img src="${uploadSrc}" alt="fixture upload">`
  )
}

async function assertReaderSanitized(reader: Locator, opts: {
  safeMarker: string
  runId: string
  uploadSrc: string
  expectSafeFormatting: boolean
  expectUploadImg: boolean
  /** How many times the stored HTML holds the upload (default 1); the reader must render each once. */
  uploadImgCount?: number
}) {
  const { safeMarker, runId, uploadSrc, expectSafeFormatting, expectUploadImg, uploadImgCount = 1 } = opts
  await expect(reader).toBeVisible()
  await expect(reader.getByText(safeMarker)).toBeVisible()

  // Body HTML only — article chrome (phase chips) legitimately uses inline style=.
  /* eslint-disable playwright/no-raw-locators -- sanitizer check inspects the raw rendered DOM (script/style/on* attrs, .article-body) that has no role or name */
  const body = reader.locator('.article-body')
  await expect(body).toBeVisible()
  await expect(body.locator('script')).toHaveCount(0)
  await expect(body.locator('iframe')).toHaveCount(0)
  await expect(body.locator('style')).toHaveCount(0)
  await expect(body.locator('[onclick]')).toHaveCount(0)
  await expect(body.locator('[onerror]')).toHaveCount(0)
  await expect(body.locator('[style]')).toHaveCount(0)
  await expect(body.locator('a[href^="javascript:"]')).toHaveCount(0)
  await expect(body.locator('[src*="evil.example"], [href*="evil.example"]')).toHaveCount(0)
  /* eslint-enable playwright/no-raw-locators */

  const html = await body.innerHTML()
  expect(html).not.toContain('evil.example')
  expect(html).not.toMatch(/javascript:/i)

  if (expectSafeFormatting) {
    await expect(body.getByRole('strong')).toContainText(`bold-${runId}`)
    await expect(body.getByRole('emphasis')).toContainText(`italic-${runId}`)
    const safeLink = body.getByRole('link', { name: `safe link ${runId}` })
    await expect(safeLink).toBeVisible()
    await expect(safeLink).toHaveAttribute('href', `https://example.com/safe-${runId}`)
    const rel = await safeLink.getAttribute('rel')
    expect(rel ?? '').toMatch(/noopener/)
  }

  if (expectUploadImg) {
    const bySrc = body.locator(`img[src="${uploadSrc}"]`)
    await expect(bySrc).toHaveCount(uploadImgCount)
    await expectImgLoaded(bySrc.first())
  }
}

async function assertStoredBodySanitized(titleEn: string, runId: string) {
  const stored = await e2eDb().article.findFirst({ where: { titleEn } })
  expect(stored, `article ${titleEn} should exist`).toBeTruthy()
  const body = stored!.bodyEn
  expect(body).not.toContain('<script')
  expect(body).not.toContain('<iframe')
  expect(body).not.toContain('<style')
  expect(body).not.toContain('onclick=')
  expect(body).not.toContain('onerror=')
  expect(body).not.toContain('evil.example')
  expect(body).not.toMatch(/javascript:/i)
  expect(body).not.toContain(`e2e128-evil-${runId}`)
  return body
}

/**
 * Rewrite createArticle Next-Action POST so raw HTML reaches the server action
 * without Tiptap filtering (editor vs server sanitizer).
 */
async function installRawBodyRewrite(page: Page, placeholder: string, rawBodyEn: string) {
  await page.route('**/*', async (route) => {
    const req = route.request()
    if (req.method() !== 'POST' || !req.headers()['next-action']) {
      await route.continue()
      return
    }
    const postData = req.postData()
    if (!postData || !postData.includes(placeholder)) {
      await route.continue()
      return
    }
    const args = JSON.parse(postData) as Array<Record<string, unknown>>
    if (args[0] && typeof args[0] === 'object') {
      args[0] = { ...args[0], bodyEn: rawBodyEn }
    }
    await route.continue({
      postData: JSON.stringify(args),
      headers: {
        ...req.headers(),
        'content-type': 'text/plain;charset=UTF-8',
      },
    })
  })
}

test.describe('Admin content authoring (seen on web)', () => {
  test('admin list search finds an article beyond page 1; filters and query survive reload (#213)', async ({
    browser,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    const runId = uniqueId()
    const prefix = `E2E213 ${runId}`
    const needle = `${prefix} needle`
    const slugPrefix = `e2e213-${runId}`
    // Needle first so the 21 newer rows push it off page 1 (page size 20).
    await createArticle({
      slug: `${slugPrefix}-needle`, titleEn: needle, bodyEn: '<p>x</p>',
      status: 'DRAFT', cyclePhases: ['OVULATION'],
    })
    for (let i = 0; i < 21; i++) {
      await createArticle({
        slug: `${slugPrefix}-f${i}`, titleEn: `${prefix} filler ${i}`, titleBn: 'শিরোনাম',
        bodyEn: '<p>x</p>', bodyBn: '<p>বাংলা</p>', status: 'PUBLISHED', cyclePhases: ['LUTEAL'],
      })
    }
    const admin = await createLoggedInAdmin(browser, {
      viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId,
    })
    try {
      const page = admin.page
      await page.goto('/content')
      await expect(page.getByRole('button', { name: needle })).toBeHidden()

      await page.getByRole('searchbox', { name: 'Search' }).fill(needle)
      await expect(page.getByRole('button', { name: needle })).toBeVisible({ timeout: 10_000 })
      await expect(page).toHaveURL(/[?&]q=/)

      await page.reload()
      await expect(page.getByRole('searchbox', { name: 'Search' })).toHaveValue(needle)
      await expect(page.getByRole('button', { name: needle })).toBeVisible()

      // Filters narrow the same search and also live in the URL.
      await page.goto(`/content?q=${encodeURIComponent(prefix)}&status=PUBLISHED&phase=LUTEAL`)
      await expect(page.getByRole('button', { name: `${prefix} filler 20` })).toBeVisible()
      await expect(page.getByRole('button', { name: needle })).toBeHidden()

      await page.goto(`/content?q=${encodeURIComponent(prefix)}&missingBangla=1`)
      await expect(page.getByRole('button', { name: needle })).toBeVisible()
      await expect(page.getByRole('button', { name: `${prefix} filler 20` })).toBeHidden()
      await page.reload()
      await expect(page.getByRole('button', { name: needle })).toBeVisible()
      await expect(page).toHaveURL(/missingBangla=1/)
    } finally {
      await e2eDb().article.deleteMany({ where: { slug: { startsWith: slugPrefix } } })
      await admin.context.close()
    }
  })

  test('category Bengali name is saved on create and inline edit (#156)', async ({
    browser,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    deviceScaleFactor,
    locale,
    timezoneId,
  }) => {
    const runId = uniqueId()
    const name = `E2E156 Category ${runId}`
    const bnCreated = `পরীক্ষা বিভাগ ${runId}`
    const bnEdited = `নতুন বিভাগ ${runId}`
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
      const page = admin.page
      await page.goto('/content')
      await page.getByRole('button', { name: 'Manage Categories' }).click()
      await page.getByLabel('New Category').fill(name)
      await page.getByLabel('Bengali Name (optional)').fill(bnCreated)
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(page.getByText(name, { exact: true })).toBeVisible()
      await expect(page.getByText(bnCreated, { exact: true })).toBeVisible()

      await page.getByRole('button', { name: `Rename category ${name}` }).click()
      const bn = page.getByLabel(`Bengali name for category ${name}`)
      // Moving focus between the two inputs must not save early.
      await page.getByLabel(`Rename category ${name}`).focus()
      await bn.focus()
      await expect(bn).toBeEditable()
      await bn.fill(bnEdited)
      await bn.press('Enter')
      await expect(page.getByText(bnEdited, { exact: true })).toBeVisible()

      const row = await e2eDb().articleCategory.findUnique({ where: { name } })
      expect(row?.nameBn).toBe(bnEdited)
    } finally {
      await e2eDb().articleCategory.deleteMany({ where: { name } })
      await admin.context.close()
    }
  })

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

      const editors = adminPage.getByRole('textbox', { name: /^(English|Bengali) Body$/ })
      await expect(editors).toHaveCount(2)
      await fillEditor(editors.nth(0), bodyEnMarker)
      await fillEditor(editors.nth(1), bodyBnMarker)

      await adminPage.getByLabel('Choose an image to insert').first().setInputFiles(FIXTURE_PNG)
      // Image alt comes from the filename.
      const enUploadImg = editors.nth(0).getByRole('img', { name: 'article-red-1x1' })
      await expect(enUploadImg).toBeVisible({ timeout: 15_000 })

      await adminPage.getByRole('checkbox', { name: 'Follicular' }).check()
      await expect(adminPage.getByRole('button', { name: 'Draft' })).toBeVisible()
      await adminPage.getByRole('button', { name: 'Save Article' }).first().click()
      await adminPage.waitForURL((url) => url.pathname === '/content')
      await expect(adminPage.getByRole('heading', { name: 'Content' })).toBeVisible()
      await expect(adminPage.getByText(titleEn)).toBeVisible()

      // ── Draft must not appear on web (same phase URL we use after publish) ─
      await web.page.goto('/content?phase=FOLLICULAR')
      await expectWebContentListSettled(web.page)
      await expect(web.page.getByRole('link', { name: titleEn })).toHaveCount(0)
      await expect(web.page.getByText(titleEn)).toHaveCount(0)

      // ── Publish the same article ───────────────────────────────────────────
      // FilterBar debounces client search. Open via the row (onRowClick → /content/[id]).
      await openAdminArticleRow(adminPage, titleEn)
      await expect(adminPage.getByRole('heading', { name: 'Edit Article' })).toBeVisible()

      await adminPage.getByRole('button', { name: 'Published' }).click()
      await adminPage.getByRole('button', { name: 'Save Changes' }).first().click()
      // Full bilingual + phases → no publish-anyway modal
      await adminPage.waitForURL((url) => url.pathname === '/content')
      await expect(adminPage.getByText(titleEn)).toBeVisible()

      // ── Published: reload the SAME Follicular URL ──────────────────────────
      await expectPublishedOnWeb(web.page, '/content?phase=FOLLICULAR', titleEn)

      // Wrong-phase negatives: wait for settled list, then absence; second untagged phase too
      await web.page.getByRole('button', { name: 'Menstrual' }).click()
      await expect(web.page).toHaveURL(/phase=MENSTRUAL/)
      await expectWebContentListSettled(web.page)
      await expect(web.page.getByRole('link', { name: titleEn })).toHaveCount(0)

      await web.page.getByRole('button', { name: 'Ovulation' }).click()
      await expect(web.page).toHaveURL(/phase=OVULATION/)
      await expectWebContentListSettled(web.page)
      await expect(web.page.getByRole('link', { name: titleEn })).toHaveCount(0)

      await web.page.getByRole('button', { name: 'Follicular' }).click()
      await expect(web.page).toHaveURL(/phase=FOLLICULAR/)
      await expectWebContentListSettled(web.page)
      await web.page.getByRole('link', { name: titleEn }).click()
      // Each article has its own URL: /content/<article id>.
      await expect(web.page).toHaveURL(/\/content\/[a-z0-9]+$/)
      await expect(web.page.getByRole('heading', { name: titleEn })).toBeVisible()
      await expect(web.page.getByText(bodyEnMarker)).toBeVisible({ timeout: 15_000 })

      const enReader = web.page.getByRole('article', { name: titleEn })
      await expect(enReader).toBeVisible()
      // Image was inserted only in the EN body.
      await expectImgLoaded(enReader.getByRole('img').first())

      await switchWebLanguage(web.page)
      await expect(web.page.getByRole('heading', { name: titleBn })).toBeVisible({ timeout: 15_000 })
      await expect(web.page.getByRole('heading', { name: titleEn })).toHaveCount(0)
      await expect(web.page.getByText(bodyBnMarker)).toBeVisible({ timeout: 15_000 })
      // BN body was text-only (no image upload into BN editor).
      const bnReader = web.page.getByRole('article', { name: titleBn })
      await expect(bnReader).toBeVisible()
      await expect(bnReader.getByRole('img')).toHaveCount(0)
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

      const editors = adminPage.getByRole('textbox', { name: /^(English|Bengali) Body$/ })
      await expect(editors).toHaveCount(2)

      // Obtain a real /uploads src that sanitize-html allows.
      await fillEditor(editors.nth(0), 'upload-seed')
      await adminPage.getByLabel('Choose an image to insert').first().setInputFiles(FIXTURE_PNG)
      const uploadImg = editors.nth(0).getByRole('img', { name: 'article-red-1x1' })
      await expect(uploadImg).toBeVisible({ timeout: 15_000 })
      const uploadSrc = await uploadImg.getAttribute('src')
      expect(uploadSrc).toMatch(/^\/uploads\//)

      // Clear the upload-seed so paste is the only body (otherwise the same /uploads
      // src remains + appears again in the pasted HTML → flaky img count 2).
      await fillEditor(editors.nth(0), '')
      const unsafeHtml = buildSanitizePayload({ safeMarker, runId, uploadSrc: uploadSrc! })
      await pasteHtmlIntoEditor(adminPage, editors.nth(0), unsafeHtml)
      await expect(editors.nth(0).getByText(safeMarker)).toBeVisible()
      // BN body required to avoid publish-anyway modal
      await fillEditor(editors.nth(1), `ই২ই১২৮ bn ${runId}`)

      await adminPage.getByRole('checkbox', { name: 'Luteal' }).check()
      await adminPage.getByRole('button', { name: 'Published' }).click()
      await adminPage.getByRole('button', { name: 'Save Article' }).first().click()
      await adminPage.waitForURL((url) => url.pathname === '/content')

      // STORED HTML (server path after whatever the editor kept)
      const storedAfterPaste = await assertStoredBodySanitized(titleEn, runId)
      expect(storedAfterPaste).toContain(safeMarker)

      // Reopen in admin: editor must not surface script/iframe/evil hosts
      await openAdminArticleRow(adminPage, titleEn)
      await expect(adminPage.getByRole('heading', { name: 'Edit Article' })).toBeVisible()
      const editEditors = adminPage.getByRole('textbox', { name: 'English Body' })
      const editHtml = await editEditors.innerHTML()
      expect(editHtml).not.toContain('<script')
      expect(editHtml).not.toContain('<iframe')
      expect(editHtml).not.toContain('evil.example')
      expect(editHtml).not.toMatch(/javascript:/i)

      await expectPublishedOnWeb(web.page, '/content?phase=LUTEAL', titleEn)
      await web.page.getByRole('link', { name: titleEn }).click()

      const reader = web.page.getByRole('article', { name: titleEn })
      await expect(reader).toBeVisible({ timeout: 15_000 })
      // Tiptap may strip formatting on paste; assert hard security removals always.
      // Safe formatting / uploads img: assert when present in stored HTML.
      const expectSafeFormatting =
        storedAfterPaste.includes(`bold-${runId}`) && storedAfterPaste.includes(`safe-${runId}`)
      const expectUploadImg = storedAfterPaste.includes(uploadSrc!)
      // Clearing the upload-seed is not always honoured by Tiptap (seen on the phone project in CI),
      // leaving the same /uploads img twice in the stored body: count what was stored.
      const uploadImgCount = Math.max(1, storedAfterPaste.split(`src="${uploadSrc}"`).length - 1)
      await assertReaderSanitized(reader, {
        safeMarker,
        runId,
        uploadSrc: uploadSrc!,
        expectSafeFormatting,
        expectUploadImg,
        uploadImgCount,
      })
    } finally {
      await admin.context.close()
    }
  })

  test('unsafe HTML via admin save action (bypassing editor) is stripped before web', async ({
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
    const titleEn = `E2E128 RawSanitize ${runId}`
    const titleBn = `ই২ই১২৮ র স্যানিটাইজ ${runId}`
    const safeMarker = `E2E128 raw-safe ${runId}`
    const placeholder = `E2E128_RAW_PLACEHOLDER_${runId}`

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

      const editors = adminPage.getByRole('textbox', { name: /^(English|Bengali) Body$/ })
      await expect(editors).toHaveCount(2)
      await fillEditor(editors.nth(0), 'upload-seed')
      await adminPage.getByLabel('Choose an image to insert').first().setInputFiles(FIXTURE_PNG)
      const uploadImg = editors.nth(0).getByRole('img', { name: 'article-red-1x1' })
      await expect(uploadImg).toBeVisible({ timeout: 15_000 })
      const uploadSrc = await uploadImg.getAttribute('src')
      expect(uploadSrc).toMatch(/^\/uploads\//)

      await fillEditor(editors.nth(0), placeholder)
      await fillEditor(editors.nth(1), `ই২ই১২৮ raw bn ${runId}`)
      await adminPage.getByRole('checkbox', { name: 'Ovulation' }).check()
      await adminPage.getByRole('button', { name: 'Published' }).click()

      const rawBodyEn = buildSanitizePayload({ safeMarker, runId, uploadSrc: uploadSrc! })
      await installRawBodyRewrite(adminPage, placeholder, rawBodyEn)
      await adminPage.getByRole('button', { name: 'Save Article' }).first().click()
      await adminPage.waitForURL((url) => url.pathname === '/content')

      const stored = await assertStoredBodySanitized(titleEn, runId)
      expect(stored).toContain(safeMarker)
      // Server sanitizer keeps strong/em, safe https link (+ rel), and /uploads img.
      expect(stored).toContain(`bold-${runId}`)
      expect(stored).toContain(`https://example.com/safe-${runId}`)
      expect(stored).toContain(uploadSrc!)

      await expectPublishedOnWeb(web.page, '/content?phase=OVULATION', titleEn)
      await web.page.getByRole('link', { name: titleEn }).click()

      const reader = web.page.getByRole('article', { name: titleEn })
      await expect(reader).toBeVisible({ timeout: 15_000 })
      await assertReaderSanitized(reader, {
        safeMarker,
        runId,
        uploadSrc: uploadSrc!,
        expectSafeFormatting: true,
        expectUploadImg: true,
      })
    } finally {
      await admin.context.close()
    }
  })
})
