import { test, expect } from '../../support/fixtures.ts'
import { createArticle } from '../../support/db.ts'

test.describe('Content (Learn)', () => {
  test.beforeAll(async () => {
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

    await createArticle({
      slug: 'e2e-draft-article',
      titleEn: 'Secret Unpublished Draft Guide',
      bodyEn: '<p>Top secret draft content.</p>',
      cyclePhases: ['MENSTRUAL'],
      categoryName: 'Cycle Health',
      status: 'DRAFT',
    })
  })

  test('draft articles are never shown to users on web', async ({ newUser }) => {
    const { page } = await newUser()
    await page.goto('/content')
    await expect(page.getByRole('heading', { name: 'Health Articles' })).toBeVisible()
    await expect(page.getByText('Secret Unpublished Draft Guide')).toBeHidden()
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

    // Open article in inline reader
    await page.getByRole('button', { name: /Understanding Menstrual Cycle Flow/ }).click()
    await expect(page.getByRole('heading', { name: 'Understanding Menstrual Cycle Flow' })).toBeVisible()
    await expect(page.getByText('This is the menstrual guide body text.')).toBeVisible()

    // Back button returns to the list
    await page.getByRole('button', { name: 'Back to articles' }).click()
    await expect(page.getByRole('heading', { name: 'Understanding Menstrual Cycle Flow' })).toBeVisible()
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

    // Open article in inline reader
    await page.getByRole('button', { name: /ফলিকুলার পর্বের শক্তি বৃদ্ধি/ }).click()
    await expect(page.getByRole('heading', { name: 'ফলিকুলার পর্বের শক্তি বৃদ্ধি' })).toBeVisible()
    await expect(page.getByText('এটি ফলিকুলার নির্দেশিকা।')).toBeVisible()

    // Back to articles button in Bengali
    await page.getByRole('button', { name: 'নিবন্ধে ফিরে যান' }).click()
    await expect(page.getByRole('heading', { name: 'ফলিকুলার পর্বের শক্তি বৃদ্ধি' })).toBeVisible()
  })
})
