/**
 * Handbook chapter "Content" (Admin) (docs/handbook/chapters/admin-content.md), ticket #246.
 * Demo articles, categories and views are written straight to the E2E database; the editor shots
 * type demo text and are never saved (the Admin session is read-only).
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '../../../support/fixtures.ts'
import { refreshData } from '../../../support/admin-charts.ts'
import { ADMIN_STATE, seedDemoMembers } from '../../support/admin-demo.ts'
import { shot } from '../../support/shot.ts'
import { demoNowMs } from '../../support/demo-clock.ts'

test.use({ storageState: ADMIN_STATE })

const DEMO_IMAGE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/demo-article.png')
const DAY = 24 * 60 * 60 * 1000
const dayStored = (now: number, n: number) => new Date(`${new Date(now - n * DAY).toISOString().slice(0, 10)}T00:00:00.000Z`)

type Phase = 'MENSTRUAL' | 'FOLLICULAR' | 'OVULATION' | 'LUTEAL'
const CATEGORIES = [['Cycle basics', 'চক্রের মূল কথা'], ['Self-care', 'নিজের যত্ন'], ['Nutrition', 'পুষ্টি']] as const
// [slug, title, category, phases, status, publishedOffsetDays (negative = past), bengali, views]
const ARTICLES: Array<[string, string, string | null, Phase[], 'DRAFT' | 'PUBLISHED' | 'ARCHIVED', number | null, boolean, number]> = [
  ['hbac-flow', 'Understanding your period flow', 'Cycle basics', ['MENSTRUAL'], 'PUBLISHED', -20, true, 9],
  ['hbac-cramps', 'Easing period cramps at home', 'Self-care', ['MENSTRUAL'], 'PUBLISHED', -14, true, 7],
  ['hbac-energy', 'Why energy rises after your period', 'Cycle basics', ['FOLLICULAR'], 'PUBLISHED', -9, false, 4],
  ['hbac-window', 'Your fertile window explained', 'Cycle basics', ['OVULATION'], 'PUBLISHED', -5, true, 6],
  ['hbac-iron', 'Iron-rich foods for your period', 'Nutrition', ['MENSTRUAL'], 'DRAFT', null, false, 0],
  ['hbac-mood', 'Mood changes before your period', 'Self-care', [], 'PUBLISHED', 3, true, 0],
  ['hbac-sleep', 'Sleeping well through the month', null, ['LUTEAL'], 'ARCHIVED', null, true, 2],
]

test.describe('Admin Content', () => {
  test.beforeAll(async ({ db }) => {
    await seedDemoMembers(db)
    const now = demoNowMs()
    const author = await db.user.findFirstOrThrow({ where: { role: 'ADMIN' } })
    await db.articleCategory.createMany({
      data: CATEGORIES.map(([name, nameBn], i) => ({ name, nameBn, slug: name.toLowerCase().replace(/[^a-z]+/g, '-'), sortOrder: i + 1 })),
      skipDuplicates: true,
    })
    const cats = new Map((await db.articleCategory.findMany()).map((c) => [c.name, c.id]))
    for (const [slug, titleEn, cat, cyclePhases, status, offset, bn, views] of ARTICLES) {
      const data = {
        titleEn, titleBn: bn ? 'ডেমো শিরোনাম' : null, bodyEn: `<p>Demo text for "${titleEn}".</p>`, bodyBn: bn ? '<p>ডেমো লেখা।</p>' : null,
        status, cyclePhases, categoryId: cat ? cats.get(cat)! : null, authorId: author.id,
        publishedAt: offset === null ? null : new Date(now + offset * DAY),
      }
      await db.article.createMany({ data: [{ slug, ...data }], skipDuplicates: true })
      const a = await db.article.findUniqueOrThrow({ where: { slug } })
      await db.articleView.createMany({
        data: Array.from({ length: views }, (_, k) => ({
          articleId: a.id, userId: `hbdemo-${String((k % 9) + 1).padStart(2, '0')}`, day: dayStored(now, Math.floor(k / 3)),
        })),
        skipDuplicates: true,
      })
    }
  })

  test('list, views column, bulk actions and categories', async ({ page }) => {
    await page.goto('/content')
    await expect(page.getByRole('heading', { name: 'Content', exact: true })).toBeVisible()
    await refreshData(page)
    await expect(page.getByText('Understanding your period flow')).toBeVisible()
    await expect(page.getByText('Scheduled', { exact: true }).first()).toBeVisible()
    await shot(page, 'ac-list')
    await page.getByRole('table').evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await shot(page, 'ac-list', { suffix: 'table' })

    // Views column: most read first.
    await page.getByRole('columnheader', { name: /Views/ }).getByRole('button').click()
    await expect(page).toHaveURL(/sort=views/)
    await expect(page.getByTestId('article-views').first()).toHaveText('9')
    await page.getByRole('table').evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await shot(page, 'ac-views')

    await page.getByRole('checkbox', { name: 'Select "Understanding your period flow"' }).check()
    await page.getByRole('checkbox', { name: 'Select "Easing period cramps at home"' }).check()
    await expect(page.getByRole('region', { name: 'Bulk actions' })).toBeVisible()
    await shot(page, 'ac-bulk')
    await page.getByRole('button', { name: 'Clear' }).click()

    await page.getByRole('button', { name: 'Manage Categories' }).click()
    await expect(page.getByRole('button', { name: 'Move category Self-care up' })).toBeVisible()
    await shot(page, 'ac-categories')
  })

  test('editor, image upload and scheduled publishing', async ({ page }) => {
    await page.goto('/content/new')
    await expect(page.getByRole('heading', { name: 'New Article' })).toBeVisible()
    await page.getByLabel('English Title').fill('Eating well during your period')
    await page.getByLabel('Bengali Title').fill('পিরিয়ডে ভালো খাবার')
    const editors = page.getByRole('textbox', { name: /^(English|Bengali) Body$/ })
    await editors.nth(0).click()
    await editors.nth(0).fill('Warm meals, plenty of water and iron-rich foods can help you feel better during your period.')
    await editors.nth(1).click()
    await editors.nth(1).fill('পিরিয়ডের সময় গরম খাবার ও পর্যাপ্ত পানি পান করুন।')
    await page.getByRole('checkbox', { name: 'Menstrual' }).check()
    await shot(page, 'ac-editor')

    await page.getByLabel('Choose an image to insert').first().setInputFiles(DEMO_IMAGE)
    await expect(editors.nth(0).getByRole('img')).toBeVisible({ timeout: 15_000 })
    await shot(page, 'ac-images')

    await page.getByRole('button', { name: 'Scheduled' }).click()
    const at = new Date(demoNowMs() + 3 * DAY)
    at.setUTCHours(9, 30, 0, 0) // the field takes Bangladesh wall time: 09:30, three days from now
    await page.getByRole('textbox', { name: 'Publish date and time' }).fill(at.toISOString().slice(0, 16).replace('T', ' '))
    await expect(page.getByText('Goes live at this time, Bangladesh time (UTC+6).')).toBeVisible()
    await shot(page, 'ac-schedule')
  })
})
