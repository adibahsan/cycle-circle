/**
 * Guard for ticket #68 (symptoms: save errors, drawn icons, chip accessibility).
 * Run: pnpm --filter @vesta/web e2e e2e/tests/symptoms-save.spec.ts
 * Nothing here saves data: every server action POST is aborted before it leaves the browser.
 */
import { test, expect, type Locator, type Page } from '@playwright/test'
import i18n from '@vesta/shared/utils/i18n'
import { statePath } from '../support/auth'
import { DESKTOP, PHONE_375, dialog, gotoQuiet, settle } from '../guards/helpers'

const en = i18n.getFixedT('en')
const EMOJI = /\p{Extended_Pictographic}/u
const CATEGORIES = ['physical', 'mood', 'discharge', 'lifestyle'] as const

/** Make every Next.js server action fail at the network layer (the save never reaches the server). */
async function failServerActions(page: Page) {
  await page.route('**/*', async (route) => {
    const req = route.request()
    if (req.method() === 'POST' && req.headers()['next-action']) return route.abort('failed')
    return route.fallback()
  })
}

/** Visible text and accessible labels under `root` that contain an emoji. */
async function emojiIn(page: Page, root: Locator): Promise<string[]> {
  const texts = await root.evaluate((el) => {
    const out: string[] = []
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const p = n.parentElement
      if (p && p.closest('[aria-hidden="true"]') == null && p.offsetParent !== null) out.push(n.textContent ?? '')
    }
    el.querySelectorAll('[aria-label]').forEach((e) => out.push(e.getAttribute('aria-label') ?? ''))
    return out
  })
  return texts.filter((t) => EMOJI.test(t))
}

/** First chip in `scope` that is not pressed yet. */
function unpressedChip(scope: Locator): Locator {
  return scope.locator('button[aria-pressed="false"]').first()
}

test.describe('symptoms page', () => {
  for (const [label, viewport] of [['desktop', DESKTOP], ['375x667', PHONE_375]] as const) {
    test(`failed save shows a translated error and keeps the selection (${label})`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await failServerActions(page)
      await gotoQuiet(page, '/symptoms')
      const group = page.getByRole('group', { name: en('symptoms.physical'), exact: true })
      const chip = unpressedChip(group)
      const name = await chip.getAttribute('aria-label')
      await chip.click()
      await page.getByRole('button', { name: /^Save \d+ changes$/ }).locator('visible=true').first().click()
      await expect(page.getByRole('status').filter({ hasText: en('symptoms.saveError') })).toBeVisible()
      await expect(group.getByRole('button', { name: name!, exact: true })).toHaveAttribute('aria-pressed', 'true')
    })
  }

  test('no emoji on the page', async ({ page }) => {
    await gotoQuiet(page, '/symptoms')
    for (const key of CATEGORIES) {
      await page.getByRole('tab', { name: new RegExp(`^${en(`symptoms.${key}`)}`) }).click()
      await settle(page, 300)
      expect(await emojiIn(page, page.locator('main'))).toEqual([])
    }
  })

  test('category tabs follow the tab pattern and each panel is a labelled group of toggles', async ({ page }) => {
    await gotoQuiet(page, '/symptoms')
    const tablist = page.getByRole('tablist')
    await expect(tablist).toHaveAccessibleName(/.+/)
    const tabs = tablist.getByRole('tab')
    await expect(tabs).toHaveCount(4)

    const first = tabs.first()
    await first.focus()
    await page.keyboard.press('ArrowRight')
    const second = tabs.nth(1)
    await expect(second).toBeFocused()
    await expect(second).toHaveAttribute('aria-selected', 'true')
    await expect(first).toHaveAttribute('tabindex', '-1')

    const panelId = await second.getAttribute('aria-controls')
    const panel = page.locator(`[id="${panelId}"]`)
    await expect(panel).toHaveRole('tabpanel')
    const group = panel.getByRole('group', { name: en('symptoms.mood'), exact: true })
    await expect(group).toBeVisible()
    const chips = group.locator('button')
    expect(await chips.count()).toBeGreaterThan(0)
    for (const chip of await chips.all()) await expect(chip).toHaveAttribute('aria-pressed', /true|false/)

    await page.keyboard.press('End')
    await expect(tabs.last()).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(first).toBeFocused()
  })
})

test.describe('quick-log pop-up', () => {
  test.use({ viewport: PHONE_375 })

  async function open(page: Page): Promise<Locator> {
    await gotoQuiet(page, '/dashboard')
    const trigger = page.locator('button[aria-haspopup="dialog"]', { hasText: en('dashboard.logSymptoms') }).first()
    await expect(trigger).toBeVisible({ timeout: 15_000 })
    await trigger.click()
    const d = dialog(page)
    await expect(d).toBeVisible()
    return d
  }

  test('failed save shows a translated error, stays open and keeps the selection', async ({ page }) => {
    await failServerActions(page)
    const d = await open(page)
    const group = d.getByRole('group', { name: en('symptoms.physical'), exact: true })
    const chip = unpressedChip(group)
    const name = await chip.getAttribute('aria-label')
    await chip.click()
    await d.getByRole('button', { name: en('quickSymptom.save'), exact: true }).click()
    await expect(d.getByRole('status').filter({ hasText: en('symptoms.saveError') })).toBeVisible()
    await expect(d).toBeVisible()
    await expect(group.getByRole('button', { name: name!, exact: true })).toHaveAttribute('aria-pressed', 'true')
  })

  test('no emoji in any category', async ({ page }) => {
    const d = await open(page)
    for (const key of CATEGORIES) {
      await d.getByRole('tab', { name: new RegExp(`^${en(`symptoms.${key}`)}`) }).click()
      await settle(page, 300)
      expect(await emojiIn(page, d)).toEqual([])
    }
  })
})

test.describe('check-in pop-up', () => {
  // 'fresh' has not logged today, so the check-in is offered. Saves are aborted, so nothing is written.
  test.use({ viewport: PHONE_375, storageState: statePath('fresh') })

  async function open(page: Page): Promise<Locator> {
    await gotoQuiet(page, '/dashboard')
    const trigger = page.getByRole('button', { name: en('checkIn.cta'), exact: true }).locator('visible=true').first()
    await expect(trigger).toBeVisible({ timeout: 15_000 })
    await trigger.click()
    const d = dialog(page)
    await expect(d).toBeVisible()
    return d
  }

  test('failed save shows a translated error, stays open and keeps the selection', async ({ page }) => {
    await failServerActions(page)
    const d = await open(page)
    const chip = unpressedChip(d.getByRole('group', { name: en('checkIn.title'), exact: true }))
    const name = await chip.getAttribute('aria-label')
    await chip.click()
    await d.getByRole('button', { name: new RegExp(`^${en('checkIn.save')}`) }).click()
    await expect(d.getByRole('status').filter({ hasText: en('symptoms.saveError') })).toBeVisible()
    await expect(d).toBeVisible()
    await expect(d.getByRole('button', { name: name!, exact: true })).toHaveAttribute('aria-pressed', 'true')
  })

  test('failed "all good" shows a translated error and stays open', async ({ page }) => {
    await failServerActions(page)
    const d = await open(page)
    await d.getByRole('button', { name: en('checkIn.allGood'), exact: true }).click()
    await expect(d.getByRole('status').filter({ hasText: en('symptoms.saveError') })).toBeVisible()
    await expect(d).toBeVisible()
  })

  test('no emoji', async ({ page }) => {
    const d = await open(page)
    await settle(page, 300)
    expect(await emojiIn(page, d)).toEqual([])
  })
})
