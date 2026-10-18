/**
 * Guard for ticket #79 (Symptoms in the new look): the page keeps the name "Symptoms" in both
 * languages, chips sit on a tinted category card and the page fits the phone.
 * Save errors, chip groups and tabs: e2e/tests/symptoms-save.spec.ts. No English in Bengali:
 * e2e/tests/bengali-no-english.spec.ts.
 * Run: pnpm --filter @vesta/web e2e e2e/tests/symptoms-look.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'
import i18n from '@vesta/shared/utils/i18n'
import { DESKTOP, PHONE_375, expectNoHorizontalOverflow, gotoQuiet } from '../guards/helpers'

async function useLanguage(page: Page, language: 'en' | 'bn') {
  await page.addInitScript((lng) => {
    try {
      const raw = localStorage.getItem('vesta-store')
      const store = raw ? JSON.parse(raw) : { state: {}, version: 0 }
      store.state = { ...store.state, language: lng }
      localStorage.setItem('vesta-store', JSON.stringify(store))
    } catch {}
  }, language)
}

for (const language of ['en', 'bn'] as const) {
  test(`page title matches the nav label (${language})`, async ({ page }) => {
    const t = i18n.getFixedT(language)
    await page.setViewportSize(DESKTOP)
    await useLanguage(page, language)
    await gotoQuiet(page, '/symptoms')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('nav.symptoms'))
  })
}

for (const [label, viewport] of [['desktop', DESKTOP], ['375x667', PHONE_375]] as const) {
  test(`chips sit on a tinted category card and the page fits (${label})`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await gotoQuiet(page, '/symptoms')
    const panel = page.getByRole('tabpanel')
    await expect(panel).toBeVisible()
    const cardBg = await panel.evaluate((el) => getComputedStyle(el.parentElement!).backgroundColor)
    const pageBg = await page.evaluate(() => getComputedStyle(document.querySelector('main') ?? document.body).backgroundColor)
    expect(cardBg).not.toBe('rgba(0, 0, 0, 0)')
    expect(cardBg).not.toBe(pageBg)
    await expectNoHorizontalOverflow(page)
  })
}
