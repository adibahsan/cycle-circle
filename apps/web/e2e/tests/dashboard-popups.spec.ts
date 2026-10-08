/**
 * Guard for ticket #39 (dashboard pop-ups on the shell, celebration as a toast).
 * Run: pnpm --filter @vesta/web e2e e2e/tests/dashboard-popups.spec.ts
 * Nothing here saves data: the seed database is shared with other guards.
 */
import { test, expect, type Locator, type Page } from '@playwright/test'
import { statePath } from '../support/auth'
import {
  DESKTOP,
  PHONE_375,
  dialog,
  expectDialogA11y,
  expectScrollLocked,
  expectScrollUnlocked,
  expectTabTrap,
  gotoQuiet,
  mockApi,
  openPopup,
} from '../guards/helpers'

interface Case {
  name: string
  /** 'fresh' = e2e persona who has not logged today (check-in available); never saves anything. */
  persona?: 'fresh'
  mocks: string[]
  trigger: (page: Page) => Locator
}

const CASES: Case[] = [
  {
    name: 'period log',
    mocks: [],
    trigger: (page) => page.locator('button:visible', { hasText: 'Log Period' }).first(),
  },
  {
    name: 'quick symptom',
    mocks: [],
    trigger: (page) => page.getByRole('button', { name: 'Log Symptoms', exact: true }).locator('visible=true').first(),
  },
  {
    name: 'check-in',
    persona: 'fresh',
    mocks: [],
    trigger: (page) => page.getByRole('button', { name: 'Check in', exact: true }).locator('visible=true').first(),
  },
  {
    name: 'profile completion',
    mocks: ['incomplete-profile'],
    trigger: (page) => page.locator('[data-tour="profile-ring"]:visible').first(),
  },
]

async function prepare(page: Page, c: Case): Promise<Locator> {
  if (c.mocks.length) await mockApi(page, c.mocks)
  await gotoQuiet(page, '/dashboard')
  const trigger = c.trigger(page)
  await expect(trigger).toBeVisible({ timeout: 15_000 })
  return trigger
}

for (const [label, viewport] of [['desktop', DESKTOP], ['375x667', PHONE_375]] as const) {
  test.describe(`dashboard pop-ups (${label})`, () => {
    test.use({ viewport })

    for (const c of CASES) {
      test.describe(c.name, () => {
        if (c.persona) test.use({ storageState: statePath(c.persona) })
        test('dialog semantics, ESC closes, focus returns', async ({ page }) => {
          const trigger = await prepare(page, c)
          const d = await openPopup(page, trigger)
          await expectDialogA11y(d)
          await page.keyboard.press('Escape')
          await expect(dialog(page)).toBeHidden()
          await expect(trigger).toBeFocused()
          await expectScrollUnlocked(page)
        })

        test('Tab stays inside, page behind is locked', async ({ page }) => {
          const trigger = await prepare(page, c)
          const d = await openPopup(page, trigger)
          await expectTabTrap(page, d)
          await expectScrollLocked(page)
        })

        if (label === '375x667') {
          test('fits the phone with the actions on screen', async ({ page }) => {
            const trigger = await prepare(page, c)
            const d = await openPopup(page, trigger)
            await page.waitForTimeout(500)
            const box = await d.boundingBox()
            expect(box!.y).toBeGreaterThanOrEqual(0)
            expect(box!.y + box!.height).toBeLessThanOrEqual(PHONE_375.height)
            const last = await d.locator('button:visible').last().boundingBox()
            expect(last!.y + last!.height).toBeLessThanOrEqual(PHONE_375.height)
          })
        }
      })
    }
  })
}

test.describe('check-in to quick symptom hand-over', () => {
  test.use({ storageState: statePath('fresh') })
  test('never two dialogs at once, and ESC returns to the check-in', async ({ page }) => {
    const trigger = await prepare(page, CASES[2])
    await openPopup(page, trigger)
    const visibleCount = () => page.locator('[role="dialog"]:visible').count()
    const seen: number[] = []
    await page.getByRole('button', { name: 'More', exact: true }).click()
    for (let i = 0; i < 20; i++) {
      seen.push(await visibleCount())
      await page.waitForTimeout(50)
    }
    expect(Math.max(...seen), `dialog counts while handing over: ${seen}`).toBeLessThanOrEqual(1)
    await expect(page.locator('[role="dialog"][aria-labelledby="quick-symptom-title"]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('[role="dialog"][aria-labelledby="quick-symptom-title"]')).toBeHidden()
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await visibleCount()).toBe(1)
  })
})

test.describe('toast', () => {
  test('is a polite live region on the toast layer that never takes focus', async ({ page }) => {
    await gotoQuiet(page, '/dashboard')
    const region = page.locator('[data-toast-region]')
    await expect(region).toBeAttached()
    await expect(region).toHaveAttribute('role', 'status')
    await expect(region).toHaveAttribute('aria-live', 'polite')
    expect(await region.evaluate((el) => getComputedStyle(el).zIndex)).toBe('80')
    expect(await region.evaluate((el) => el.contains(document.activeElement))).toBe(false)
  })
})
