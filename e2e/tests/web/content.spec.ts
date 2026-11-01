import { test, expect } from '../../support/fixtures.ts'
import { createArticle } from '../../support/db.ts'

test.describe('Content (Learn)', () => {
  let draftId = ''
  // beforeEach (not beforeAll): with E2E_SKIP_RESET and parallel workers, a cold
  // beforeAll can race the first test; re-upsert is cheap and keeps titles findable.
  test.beforeEach(async () => {
    await createArticle({
      slug: 'e2e-menstrual-article',
      titleEn: 'Understanding Menstrual Cycle Flow',
      titleBn: 'ঋতুস্রাব চক্রের প্রবাহ বোঝা',
      bodyEn: '<p>This is the menstrual guide body text.</p>',
      bodyBn: '<p>এটি ঋতুস্রাব নির্দেশিকার বিস্তারিত পাঠ।</p>',
      cyclePhases: ['MENSTRUAL'],
      categoryName: 'Cycle Health',
      status: 'PUBLISHED',
    })

    await createArticle({
      slug: 'e2e-follicular-article',
      titleEn: 'Follicular Energy Surge',
      titleBn: 'ফলিকুলার পর্বের শক্তি বৃদ্ধি',
      bodyEn: '<p>This is the follicular guide body text.</p>',
      bodyBn: '<p>এটি ফলিকুলার নির্দেশিকা।</p>',
      cyclePhases: ['FOLLICULAR'],
      categoryName: 'Cycle Health',
      status: 'PUBLISHED',
    })

    draftId = (await createArticle({
      slug: 'e2e-draft-article',
      titleEn: 'Secret Unpublished Draft Guide',
      bodyEn: '<p>Top secret draft content.</p>',
      cyclePhases: ['MENSTRUAL'],
      categoryName: 'Cycle Health',
      status: 'DRAFT',
    })).id
  })

  test('draft articles are never shown to users on web', async ({ newUser }) => {
    const { page } = await newUser()
    await page.goto('/content')
    await expect(page.getByRole('heading', { name: 'Health Articles' })).toBeVisible()
    await expect(page.getByText('Secret Unpublished Draft Guide')).toHaveCount(0)

    // Under the phase filter where a leaked draft would appear (Menstrual)
    await page.getByRole('button', { name: 'Menstrual', exact: true }).click()
    await expect(page).toHaveURL(/phase=MENSTRUAL/)
    await expect(page.getByText('Secret Unpublished Draft Guide')).toHaveCount(0)
  })

  test('filter articles by phase and open one in the reader in English', async ({ newUser }) => {
    const { page } = await newUser()
    await page.goto('/content')

    // Filter by Follicular phase
    await page.getByRole('button', { name: 'Follicular', exact: true }).click()
    await expect(page).toHaveURL(/phase=FOLLICULAR/)
    await expect(page.getByRole('heading', { name: 'Follicular Energy Surge' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Understanding Menstrual Cycle Flow' })).toBeHidden()

    // Filter by Menstrual phase
    await page.getByRole('button', { name: 'Menstrual', exact: true }).click()
    await expect(page).toHaveURL(/phase=MENSTRUAL/)
    await expect(page.getByRole('heading', { name: 'Understanding Menstrual Cycle Flow' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Follicular Energy Surge' })).toBeHidden()

    // Open the article: it has its own URL, /content/<article id>
    await page.getByRole('link', { name: /Understanding Menstrual Cycle Flow/ }).click()
    await expect(page).toHaveURL(/\/content\/[a-z0-9]+$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Understanding Menstrual Cycle Flow' })).toBeVisible()
    await expect(page.getByText('This is the menstrual guide body text.')).toBeVisible()
    const articleUrl = page.url()

    // The URL opens the same article directly (shareable, survives reload)
    await page.goto(articleUrl)
    await expect(page.getByRole('heading', { level: 1, name: 'Understanding Menstrual Cycle Flow' })).toBeVisible()
    await expect(page.getByText('This is the menstrual guide body text.')).toBeVisible()

    // Back link returns to the list
    await page.getByRole('link', { name: 'Back to articles' }).click()
    await expect(page).toHaveURL(/\/content$/)
    await expect(page.getByRole('heading', { name: 'Health Articles' })).toBeVisible()
  })

  test('filter articles by phase and open one in the reader in Bengali', async ({ newUser }) => {
    const { page, context } = await newUser()
    await context.addCookies([{ name: 'vesta_lang', value: 'bn', path: '/', domain: 'localhost' }])
    await page.goto('/content')

    await expect(page.getByRole('heading', { name: 'স্বাস্থ্য নিবন্ধ' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'ঋতুস্রাব চক্রের প্রবাহ বোঝা' })).toBeVisible()

    // Filter by Follicular (ফলিকুলার)
    await page.getByRole('button', { name: 'ফলিকুলার', exact: true }).click()
    await expect(page).toHaveURL(/phase=FOLLICULAR/)
    await expect(page.getByRole('heading', { name: 'ফলিকুলার পর্বের শক্তি বৃদ্ধি' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'ঋতুস্রাব চক্রের প্রবাহ বোঝা' })).toBeHidden()

    // Open the article on its own URL
    await page.getByRole('link', { name: /ফলিকুলার পর্বের শক্তি বৃদ্ধি/ }).click()
    await expect(page).toHaveURL(/\/content\/[a-z0-9]+$/)
    await expect(page.getByRole('heading', { level: 1, name: 'ফলিকুলার পর্বের শক্তি বৃদ্ধি' })).toBeVisible()
    await expect(page.getByText('এটি ফলিকুলার নির্দেশিকা।')).toBeVisible()

    // Back to articles link in Bengali
    await page.getByRole('link', { name: 'নিবন্ধে ফিরে যান' }).click()
    await expect(page.getByRole('heading', { name: 'ফলিকুলার পর্বের শক্তি বৃদ্ধি' })).toBeVisible()
  })

  test('an unknown or draft article id shows not-found, never the article', async ({ newUser }) => {
    const { page } = await newUser()
    // The route streams under a loading skeleton, so the status is already 200 when the page
    // calls notFound(); assert the not-found page (one h1, a way home) instead of the status.
    for (const path of ['/content/not-a-real-article-id', `/content/${draftId}`]) {
      await page.goto(path)
      await expect(page.getByRole('link', { name: /dashboard|ড্যাশবোর্ড/i }).first()).toBeVisible()
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
      await expect(page.getByRole('heading', { level: 1, name: 'Secret Unpublished Draft Guide' })).toHaveCount(0)
      await expect(page.getByText('Top secret draft content.')).toHaveCount(0)
    }
  })
})
