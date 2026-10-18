/**
 * Ticket #80: Insights in the new look.
 * Charts draw in token colours in light and dark; sections carry right-aligned subtitles.
 * Run: pnpm --filter @vesta/web e2e -- e2e/tests/insights-look.spec.ts
 * Screenshots for the PR land in test-results/insights-look/.
 */
import { test, expect, type Page } from '@playwright/test'
import i18n from '@vesta/shared/utils/i18n'
import { gotoQuiet, expectNoHorizontalOverflow, DESKTOP, PHONE_375 } from '../guards/helpers'

const en = i18n.getFixedT('en')

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => document.documentElement.classList.toggle('dark', t === 'dark'), theme)
}

/** The computed colour a token resolves to on <html>, as the browser serialises it. */
async function tokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((tk) => {
    const probe = document.createElement('div')
    probe.style.color = `var(${tk})`
    document.body.appendChild(probe)
    const c = getComputedStyle(probe).color
    probe.remove()
    return c
  }, token)
}

// The seed persona has symptom logs but no complete cycle, so only the symptom chart renders;
// the cycle length line is checked when that persona has one.
for (const theme of ['light', 'dark'] as const) {
  test(`${theme}: symptom bars use the lavender accent token`, async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await gotoQuiet(page, '/insights')
    await setTheme(page, theme)
    const bar = page.locator('.recharts-bar-rectangle path').first()
    await expect(bar).toBeVisible()
    const fill = await bar.evaluate((el) => getComputedStyle(el).fill)
    expect(fill).toBe(await tokenColor(page, '--color-accent-lavender'))
  })

  test(`${theme}: the cycle length line uses the pink accent token`, async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await gotoQuiet(page, '/insights')
    const heading = page.getByRole('heading', { name: en('insights.cycleLengthTrend') })
    test.skip((await heading.count()) === 0, 'persona has no completed cycle')
    await setTheme(page, theme)
    const line = page.locator('.recharts-line-curve').first()
    await expect(line).toBeVisible()
    const stroke = await line.evaluate((el) => getComputedStyle(el).stroke)
    expect(stroke).toBe(await tokenColor(page, '--color-accent-pink'))
  })
}

test('section headings carry a subtitle on the same row', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await gotoQuiet(page, '/insights')
  const heading = page.getByRole('heading', { name: en('insights.symptomFrequency') })
  await expect(heading).toBeVisible()
  // Symptom frequency always covers all time; the subtitle sits beside the heading in the same header row.
  const subtitle = heading.locator('..').locator('p')
  await expect(subtitle).toHaveText(en('insights.allTime'))
  const [h, s] = [await heading.boundingBox(), await subtitle.boundingBox()]
  // Right-aligned on the title row: to the right of the heading and vertically overlapping it.
  expect(s!.x).toBeGreaterThan(h!.x + h!.width)
  expect(s!.y).toBeLessThan(h!.y + h!.height)
})

for (const [label, viewport] of [['desktop', DESKTOP], ['phone', PHONE_375]] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`screenshot: ${label} ${theme}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await gotoQuiet(page, '/insights')
      await setTheme(page, theme)
      await expect(page.locator('.recharts-wrapper').first()).toBeVisible()
      await expectNoHorizontalOverflow(page)
      await page.screenshot({ path: `test-results/insights-look/${label}-${theme}.png`, fullPage: true })
    })
  }
}
