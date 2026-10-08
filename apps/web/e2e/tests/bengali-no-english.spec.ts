/**
 * Guard for ticket #47: in Bengali, no Latin-letter text or accessible label appears on any signed-in page
 * or key pop-up. The narrow allow-list (brand name, units after a number, user content) is in
 * e2e/support/latin-scan.ts.
 * Run: pnpm e2e e2e/tests/bengali-no-english.spec.ts
 */
import { test, expect, type Locator, type Page } from '@playwright/test'
import i18n from '@vesta/shared/utils/i18n'
import { PHONE_375, DESKTOP, dialog, gotoQuiet, mockApi, settle, suppressAutoPrompts } from '../guards/helpers'
import { collectTexts, latinOffenders } from '../support/latin-scan'

const bn = i18n.getFixedT('bn')

/** Persisted store read by the app on load: language is the only thing set. */
async function useBengali(page: Page) {
  await page.addInitScript(() => {
    try {
      const raw = localStorage.getItem('vesta-store')
      const store = raw ? JSON.parse(raw) : { state: {}, version: 0 }
      store.state = { ...store.state, language: 'bn' }
      localStorage.setItem('vesta-store', JSON.stringify(store))
    } catch {}
  })
}

/** Names the signed-in user typed themselves (profile names); they are content, not UI copy. */
async function userStrings(page: Page): Promise<string[]> {
  try {
    const res = await page.request.get('/api/profiles')
    if (!res.ok()) return []
    const body = (await res.json()) as { profiles?: { name?: string }[] }
    return (body.profiles ?? []).map((p) => p.name ?? '').filter(Boolean)
  } catch {
    return []
  }
}

async function expectNoEnglish(page: Page, label: string, root = 'body') {
  const bad = latinOffenders(await collectTexts(page, root), await userStrings(page))
  expect(bad.map((b) => `${b.where}: ${JSON.stringify(b.value)}`), `English left on ${label}`).toEqual([])
}

const PAGES = ['/dashboard', '/calendar', '/insights', '/symptoms', '/content', '/settings', '/profiles', '/subscription', '/feedback']

for (const [name, viewport] of [['desktop', DESKTOP], ['phone 375', PHONE_375]] as const) {
  test.describe(`bengali: pages (${name})`, () => {
    test.use({ viewport })
    for (const route of PAGES) {
      test(route, async ({ page }) => {
        await useBengali(page)
        await gotoQuiet(page, route)
        await expect(page.locator('html')).toHaveAttribute('lang', 'bn')
        await expectNoEnglish(page, route)
      })
    }
  })
}

test.describe('bengali: public pages', () => {
  test.use({ viewport: PHONE_375, storageState: { cookies: [], origins: [] } })
  for (const route of ['/welcome', '/login', '/get-started', '/privacy', '/terms', '/no-such-page']) {
    test(route, async ({ page }) => {
      await useBengali(page)
      await gotoQuiet(page, route)
      await expectNoEnglish(page, route)
    })
  }
})

interface Popup {
  id: string
  route: string
  mocks?: string[]
  phone?: boolean
  /** Leave auto prompts alone (the pop-up IS an auto prompt). */
  loud?: boolean
  open: (page: Page) => Locator | Promise<Locator>
}

const POPUPS: Popup[] = [
  { id: 'period-log', route: '/dashboard', open: (p) => p.getByRole('button', { name: bn('dashboard.logPeriod') }).first() },
  { id: 'quick-symptom', route: '/dashboard', open: (p) => p.getByRole('button', { name: bn('dashboard.logSymptoms') }).first() },
  { id: 'calendar-day', route: '/calendar', open: (p) => p.locator('[role="gridcell"] button:visible').first() },
  { id: 'period-log-edit', route: '/calendar', open: (p) => p.locator(`button[aria-label^="${bn('calendar.editLogStarting', { date: '@@' }).split('@@')[0]}"]:visible`).first() },
  { id: 'logout', route: '/settings', open: (p) => p.getByRole('button', { name: bn('settings.logout') }).first() },
  { id: 'profile-edit', route: '/profiles', open: (p) => p.locator(`button[aria-label^="${bn('profiles.editProfile')}"]:visible`).first() },
  { id: 'profile-add', route: '/profiles', open: (p) => p.getByRole('button', { name: bn('profiles.add') }).first() },
  { id: 'paywall', route: '/subscription', mocks: ['free-user'], open: (p) => p.locator('main button:visible').filter({ hasText: bn('subscription.upgradeButton') }).first() },
  { id: 'profile-completion', route: '/dashboard', mocks: ['incomplete-profile'], open: (p) => p.locator('[data-tour="profile-ring"] button, [data-tour="profile-ring"]').first() },
  { id: 'trial-pill', route: '/dashboard', mocks: ['email-trial'], open: (p) => p.locator('button[aria-label*="Trial ends"], button[aria-label*="ট্রায়াল"]').first() },
  { id: 'more-sheet', route: '/dashboard', phone: true, open: (p) => p.locator('nav button[aria-haspopup="dialog"]:visible').first() },
]

for (const c of POPUPS) {
  test.describe(`bengali: pop-up ${c.id}`, () => {
    test.use({ viewport: PHONE_375 })
    test('has no English', async ({ page }) => {
      await useBengali(page)
      if (c.mocks) await mockApi(page, c.mocks)
      await gotoQuiet(page, c.route)
      const trigger = await c.open(page)
      await expect(trigger).toBeVisible({ timeout: 15_000 })
      await trigger.click()
      await expect(dialog(page)).toBeVisible()
      await settle(page, 600)
      await expectNoEnglish(page, `pop-up ${c.id}`)
    })
  })
}

test.describe('bengali: auto prompts and locks', () => {
  test.use({ viewport: PHONE_375 })

  test('late-period alert', async ({ page }) => {
    await useBengali(page)
    await mockApi(page, ['late-period'])
    await page.goto('/dashboard')
    await expect(dialog(page)).toBeVisible({ timeout: 20_000 })
    await settle(page, 600)
    await expectNoEnglish(page, 'late-period alert')
  })

  test('trial-expired lock', async ({ page }) => {
    await useBengali(page)
    await mockApi(page, ['trial-expired'])
    await suppressAutoPrompts(page)
    await page.goto('/dashboard')
    await expect(dialog(page)).toBeVisible({ timeout: 20_000 })
    await settle(page, 600)
    await expectNoEnglish(page, 'trial lock')
  })

  test('onboarding tour', async ({ page }) => {
    await useBengali(page)
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('e2e_tour_armed')) {
        sessionStorage.setItem('e2e_tour_armed', '1')
        sessionStorage.setItem('vesta_replay_tour', '1')
      }
    })
    await gotoQuiet(page, '/dashboard')
    await expect(page.locator('[role="dialog"][aria-labelledby^="tour-title-"]')).toBeVisible({ timeout: 20_000 })
    await expectNoEnglish(page, 'tour')
  })
})
