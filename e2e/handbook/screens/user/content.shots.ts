/**
 * Handbook chapter "Content" (docs/handbook/chapters/content.md), ticket #243.
 * The articles are demo text written for the handbook; the User is a demo User.
 */
import { test, expect } from '../../../support/fixtures.ts'
import { createArticle } from '../../../support/db.ts'
import { suppressAutoPrompts } from '../../../support/prompts.ts'
import { demoPhoneUser } from '../../support/demo-users.ts'
import { shot } from '../../support/shot.ts'

const PHONE = '01711223363'

const ARTICLES = [
  { slug: 'hb-understanding-flow', titleEn: 'Understanding your period flow', cyclePhases: ['MENSTRUAL'] as const, categoryName: 'Cycle basics', bodyEn: '<p>Flow changes from day to day. Light, medium and heavy days are all common, and tracking them helps you notice what is normal for you.</p><h2>What to note</h2><p>Write down how many days your period lasts and whether the flow feels different from last month.</p><ul><li>Light days at the start and end</li><li>Heaviest flow on days one and two</li></ul>' },
  { slug: 'hb-easing-cramps', titleEn: 'Easing period cramps at home', cyclePhases: ['MENSTRUAL'] as const, categoryName: 'Self-care', bodyEn: '<p>Warmth, gentle movement and rest can ease cramps for many people.</p>' },
  { slug: 'hb-follicular-energy', titleEn: 'Why energy rises after your period', cyclePhases: ['FOLLICULAR'] as const, categoryName: 'Cycle basics', bodyEn: '<p>After bleeding stops, hormones shift and many people feel more energetic.</p>' },
  { slug: 'hb-fertile-window', titleEn: 'Your fertile window explained', cyclePhases: ['OVULATION'] as const, categoryName: 'Cycle basics', bodyEn: '<p>The fertile window is the few days around ovulation when pregnancy is most likely.</p>' },
  { slug: 'hb-luteal-mood', titleEn: 'Mood changes before your period', cyclePhases: ['LUTEAL'] as const, categoryName: 'Self-care', bodyEn: '<p>Feeling more tired or emotional in the week before a period is common.</p>' },
  { slug: 'hb-sleep', titleEn: 'Sleeping well through the month', cyclePhases: ['MENSTRUAL', 'LUTEAL'] as const, categoryName: 'Self-care', bodyEn: '<p>A regular bedtime helps at every phase of the cycle.</p>' },
]

test.describe('Content', () => {
  test('Learn list, phase filter, category chips and the reader', async ({ browser, days }, testInfo) => {
    for (const a of ARTICLES) await createArticle({ ...a, cyclePhases: [...a.cyclePhases] })
    const context = await demoPhoneUser(browser, testInfo.project.use, PHONE)
    try {
      // Period started 2 days ago: the User is in the Menstrual phase.
      const res = await context.request.post('/api/profiles', {
        data: { name: 'Rina', relation: 'SELF', cycleLength: 28, periodLength: 5, lastPeriodStart: days.daysAgo(2), goal: 'tracking' },
      })
      expect(res.status()).toBe(201)
      const page = await context.newPage()
      await suppressAutoPrompts(page)

      await page.goto('/content')
      await expect(page.getByRole('heading', { name: 'Health Articles' })).toBeVisible()
      await expect(page.getByText('Understanding your period flow')).toBeVisible()
      await shot(page, 'ct-learn')

      await page.getByRole('button', { name: 'Follicular', exact: true }).click()
      await expect(page).toHaveURL(/phase=FOLLICULAR/)
      await expect(page.getByText('Why energy rises after your period')).toBeVisible()
      await expect(page.getByText('Understanding your period flow')).toHaveCount(0)
      await shot(page, 'ct-filter')

      await page.getByRole('button', { name: 'All Articles' }).click()
      await page.getByRole('button', { name: 'Self-care', exact: true }).click()
      await expect(page.getByText('Easing period cramps at home')).toBeVisible()
      await expect(page.getByText('Your fertile window explained')).toHaveCount(0)
      await shot(page, 'ct-filter', { suffix: 'category' })

      await page.getByRole('button', { name: 'All', exact: true }).click()
      await page.getByRole('link', { name: /Understanding your period flow/ }).click()
      await expect(page.getByRole('heading', { level: 1, name: 'Understanding your period flow' })).toBeVisible()
      await shot(page, 'ct-reader')
      await scrollMore(page)
      await shot(page, 'ct-reader', { suffix: 'more-to-read' })
    } finally {
      await context.close()
    }
  })
})

async function scrollMore(page: import('@playwright/test').Page) {
  await page.getByText('More to read', { exact: true }).evaluate((el) => el.scrollIntoView({ block: 'start' }))
}
