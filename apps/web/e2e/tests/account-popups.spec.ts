/**
 * Guard for ticket #40 (account, billing and alert pop-ups on the shell).
 * Run: pnpm --filter @vesta/web e2e e2e/tests/account-popups.spec.ts
 */
import { test, expect, type Page, type Locator } from '@playwright/test'
import {
  PHONE_375,
  dialog,
  expectDialogA11y,
  expectOnTop,
  expectTabTrap,
  expectWithinViewport,
  gotoQuiet,
  asFreeSubscriber,
  gotoSubscriptionClientSide,
  mockApi,
  openPopup,
  settle,
  sampleTransforms,
} from '../guards/helpers'

interface Case {
  name: string
  route: string
  mocks: string[]
  fresh?: 'phone' | 'nophone'
  trigger: (page: Page) => Locator
}

const CASES: Case[] = [
  {
    name: 'subscription phone dialog',
    route: '/subscription',
    mocks: ['email-trial'],
    fresh: 'nophone',
    trigger: (p) => p.getByRole('button', { name: /upgrade to pro|প্রো/i }).first(),
  },
  {
    name: 'subscription BDApps dialog',
    route: '/subscription',
    mocks: ['free-user'],
    fresh: 'phone',
    trigger: (p) => p.getByRole('button', { name: /upgrade to pro|প্রো/i }).first(),
  },
  {
    name: 'profile edit dialog',
    route: '/profiles',
    mocks: ['free-user'],
    trigger: (p) => p.locator('button[aria-label^="Edit "]').first(),
  },
  {
    name: 'profile delete dialog',
    route: '/profiles',
    mocks: ['free-user'],
    trigger: (p) => p.locator('button[aria-label^="Delete "]').first(),
  },
  {
    name: 'settings logout confirm',
    route: '/settings',
    mocks: ['free-user'],
    trigger: (p) => p.getByRole('button', { name: /^log ?out$/i }).first(),
  },
]

for (const vp of [{ label: 'desktop', size: undefined }, { label: '375x667', size: PHONE_375 }]) {
  test.describe(`account pop-ups (${vp.label})`, () => {
    if (vp.size) test.use({ viewport: vp.size })

    for (const c of CASES) {
      test.describe(c.name, () => {
        async function open(page: Page, baseURL?: string) {
          if (c.fresh) await asFreeSubscriber(page, c.fresh === 'nophone')
          await mockApi(page, c.mocks)
          if (c.fresh) await gotoSubscriptionClientSide(page)
          else await gotoQuiet(page, c.route)
          const trigger = c.trigger(page)
          await expect(trigger).toBeVisible({ timeout: 15_000 })
          const d = await openPopup(page, trigger)
          return { trigger, d }
        }

        test('dialog semantics, on top, inside the viewport', async ({ page, baseURL }) => {
          const { d } = await open(page, baseURL)
          await expectDialogA11y(d)
          await expectOnTop(page, d)
          await expectWithinViewport(page, d)
        })

        test('ESC closes and focus returns to the trigger', async ({ page, baseURL }) => {
          const { trigger } = await open(page, baseURL)
          await page.keyboard.press('Escape')
          await expect(dialog(page)).toBeHidden()
          await expect(trigger).toBeFocused()
        })

        test('Tab and Shift+Tab stay inside', async ({ page, baseURL }) => {
          const { d } = await open(page, baseURL)
          await expectTabTrap(page, d)
        })
      })
    }
  })
}

test.describe('edit profile at 375x667', () => {
  test.use({ viewport: PHONE_375 })
  test('actions stay visible and the sheet fits the screen', async ({ page }) => {
    await mockApi(page, ['free-user'])
    await gotoQuiet(page, '/profiles')
    const d = await openPopup(page, page.locator('button[aria-label^="Edit "]').first())
    await settle(page, 600)
    await expectWithinViewport(page, d)
    const save = d.getByRole('button', { name: /save/i })
    await expect(save).toBeInViewport({ ratio: 1 })
    const box = await d.boundingBox()
    expect(box!.y + box!.height).toBeLessThanOrEqual(667)
  })
})

test.describe('BDApps dialog', () => {
  test('has an accessible name; live region covers only status text', async ({ page, baseURL }) => {
    await asFreeSubscriber(page, false)
    await mockApi(page, ['free-user'])
    await gotoSubscriptionClientSide(page)
    const d = await openPopup(page, page.getByRole('button', { name: /upgrade to pro|প্রো/i }).first())
    // Named by aria-label or aria-labelledby: assert the computed name, not one attribute.
    await expect(d).toHaveAccessibleName(/\S/)
    const live = d.locator('[aria-live]')
    await expect(live).toHaveCount(1)
    expect(await live.evaluate((el) => el.querySelectorAll('button, a, input').length)).toBe(0)
    expect(await d.evaluate((el) => el.hasAttribute('aria-live'))).toBe(false)
  })
})

test.describe('late-period alert', () => {
  test('opens as a prompt-layer dialog; ESC closes it; focus is trapped', async ({ page }) => {
    await mockApi(page, ['free-user', 'late-period'])
    await page.goto('/dashboard')
    const d = page.locator('[aria-labelledby="late-alert-title"]')
    await expect(d).toBeVisible({ timeout: 20_000 })
    await expect(d).toHaveAttribute('data-popup-layer', 'prompt')
    await expectDialogA11y(d)
    await expectTabTrap(page, d)
    await page.keyboard.press('Escape')
    await expect(d).toBeHidden()
  })
})

test.describe('trial lock', () => {
  const lock = (page: Page) => page.locator('[aria-labelledby="trial-expired-title"]')
  async function gotoLocked(page: Page) {
    await mockApi(page, ['trial-expired'])
    await page.goto('/dashboard')
    await expect(lock(page)).toBeVisible({ timeout: 20_000 })
    await settle(page, 600)
  }

  test('layer 70, valid markup, no close button', async ({ page }) => {
    await gotoLocked(page)
    const d = lock(page)
    await expect(d).toHaveAttribute('data-popup-layer', 'lock')
    await expectDialogA11y(d)
    await expectOnTop(page, d)
    await expect(d.getByRole('button', { name: /close/i })).toHaveCount(0)
    expect(await d.locator('a button, button a').count()).toBe(0)
    await expect(d.getByRole('link', { name: /upgrade|আপগ্রেড/i })).toBeVisible()
  })

  test('ESC, backdrop click and Tab never close or escape it', async ({ page }) => {
    await gotoLocked(page)
    const d = lock(page)
    await page.keyboard.press('Escape')
    await expect(d).toBeVisible()
    await page.mouse.click(5, 5)
    await expect(d).toBeVisible()
    await expectTabTrap(page, d)
    await page.keyboard.press('Escape')
    await expect(d).toBeVisible()
  })

  test('toast layer is above the lock', async ({ page }) => {
    await gotoLocked(page)
    const layers = await page.evaluate(() => {
      const root = document.querySelector('[data-popup-layer="lock"]')!.parentElement!
      const toast = document.querySelector<HTMLElement>('[data-toast-region]')!
      return {
        lock: Number(getComputedStyle(root).zIndex),
        toast: Number(getComputedStyle(toast).zIndex),
        // Above the lock but inert: never focusable, clicks pass through to the lock.
        toastInert: toast.inert,
      }
    })
    expect(layers).toEqual({ lock: 70, toast: 80, toastInert: true })
  })
})

test.describe('trial lock at 375x667', () => {
  test.use({ viewport: PHONE_375 })
  test('fits the screen and stays open on ESC', async ({ page }) => {
    await mockApi(page, ['trial-expired'])
    await page.goto('/dashboard')
    const d = page.locator('[aria-labelledby="trial-expired-title"]')
    await expect(d).toBeVisible({ timeout: 20_000 })
    await expectWithinViewport(page, d)
    await page.keyboard.press('Escape')
    await expect(d).toBeVisible()
  })
})

test.describe('exit animation (close only is sampled, so the open animation cannot satisfy it)', () => {
  const cases = [
    { name: 'profile delete', sel: 'button[aria-label^="Delete "]' },
    { name: 'profile edit', sel: 'button[aria-label^="Edit "]' },
  ]
  async function closeTransforms(page: Page, sel: string) {
    await mockApi(page, ['free-user'])
    await gotoQuiet(page, '/profiles')
    const trigger = page.locator(sel).first()
    await expect(trigger).toBeVisible({ timeout: 15_000 })
    await trigger.click()
    await expect(dialog(page)).toBeVisible()
    await settle(page, 800)
    return sampleTransforms(page, async () => {
      await page.keyboard.press('Escape')
      await expect(dialog(page)).toBeHidden()
    })
  }

  for (const c of cases) {
    test(`${c.name}: close animates with full motion`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      expect((await closeTransforms(page, c.sel)).length).toBeGreaterThan(0)
    })
    test(`${c.name}: no transform on close with reduced motion`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      expect(await closeTransforms(page, c.sel)).toEqual([])
    })
  }
})
