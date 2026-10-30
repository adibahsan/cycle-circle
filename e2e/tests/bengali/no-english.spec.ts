/**
 * #133 Bengali pass (web-bengali): with `vesta_lang=bn`, visit every web page and open every
 * pop-up the flows reach; fail when visible Latin copy remains (allow-list in support/latin-scan.ts).
 * Admin is English-only and out of scope. Each leftover page/area → needs-triage issue + test.fail().
 */
import type { BrowserContext, Locator, Page } from '@playwright/test'
import { test, expect } from '../../support/fixtures.ts'
import { BN, expectNoEnglish, useBengali } from '../../support/bengali.ts'
import { createArticle, db, ensureUserProfile, setPeriodLogs, setUserSubscription } from '../../support/db.ts'
import { suppressAutoPrompts } from '../../support/prompts.ts'
import { openDialog } from '../../support/dialogs.ts'
import { createEmailTrialUser, toDbPhone } from '../../support/users.ts'

const SIGNED_IN = [
  '/dashboard',
  '/calendar',
  '/insights',
  '/symptoms',
  '/content',
  '/settings',
  '/profiles',
  '/subscription',
  '/feedback',
] as const

const PUBLIC = ['/welcome', '/login', '/get-started', '/privacy', '/terms', '/email-login', '/no-such-page'] as const

async function prepareSignedIn(page: Page, context: BrowserContext, phone: string) {
  await ensureUserProfile(phone, { name: 'বাংলা ইউজার', goal: 'track', cycleLength: 28, periodLength: 5 })
  await suppressAutoPrompts(page)
  await useBengali(context, page)
}

test.describe('bengali: signed-in pages', () => {
  for (const route of SIGNED_IN) {
    test(route, async ({ newUser }) => {
      // Learn category chip "Cycle Health" is still English (#156).
      if (route === '/content') {
        test.fail(true, 'https://github.com/adibahsan/cycle-circle/issues/156')
        // The chip shows only while a published article has that category; on a fresh DB that
        // depended on content.spec having run first. Publish one here (and bust web's list cache).
        await createArticle({
          slug: 'e2e-bn-cycle-health',
          titleEn: 'Cycle health basics',
          titleBn: 'চক্রের স্বাস্থ্যের প্রাথমিক কথা',
          bodyEn: '<p>Cycle health basics.</p>',
          bodyBn: '<p>চক্রের স্বাস্থ্যের প্রাথমিক কথা।</p>',
          cyclePhases: ['MENSTRUAL'],
          categoryName: 'Cycle Health',
          status: 'PUBLISHED',
        })
      }
      const { page, context, phone } = await newUser()
      await prepareSignedIn(page, context, phone)
      await page.goto(route)
      await expect(page.locator('html')).toHaveAttribute('lang', 'bn')
      await expectNoEnglish(page, route)
    })
  }
})

test.describe('bengali: public pages', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  for (const route of PUBLIC) {
    test(route, async ({ page, context }) => {
      await useBengali(context, page)
      await page.goto(route)
      await expectNoEnglish(page, route)
    })
  }
})

test.describe('bengali: onboarding', () => {
  test('/onboarding', async ({ newUser }) => {
    const { page, context } = await newUser()
    await useBengali(context, page)
    await page.goto('/onboarding')
    await expect(page.locator('html')).toHaveAttribute('lang', 'bn')
    await expectNoEnglish(page, '/onboarding')
  })
})

interface PopupCase {
  id: string
  open: (page: Page) => Locator | Promise<Locator>
  /** Opens inline content, not a shell dialog. */
  inline?: boolean
  setup?: (args: { page: Page; phone: string; context: import('@playwright/test').BrowserContext }) => Promise<void>
}

const POPUPS: PopupCase[] = [
  {
    id: 'period-log',
    open: (p) => p.getByRole('button', { name: BN.logPeriod }).first(),
  },
  {
    id: 'quick-symptom',
    // Same-named logging nudge navigates; the dialog trigger declares aria-haspopup.
    // eslint-disable-next-line playwright/no-raw-locators -- trigger identified by aria-haspopup, its Bengali name is the thing under test
    open: (p) => p.locator('button[aria-haspopup="dialog"]', { hasText: BN.logSymptoms }).first(),
  },
  {
    id: 'calendar-day',
    inline: true,
    // eslint-disable-next-line playwright/no-raw-locators -- trigger identified by aria-pressed; its Bengali name is the thing under test
    open: (p) => p.locator('button[aria-pressed]:visible').first(),
    setup: async ({ page, phone }) => {
      const profile = await ensureUserProfile(phone, { name: 'বাংলা ইউজার' })
      const { bangladeshDays } = await import('../../support/bangladesh-day.ts')
      const days = await bangladeshDays()
      await setPeriodLogs(profile.id, [
        { startDate: days.dateOf(days.daysAgo(10)), endDate: days.dateOf(days.daysAgo(6)) },
      ])
      await page.goto('/calendar')
    },
  },
  {
    id: 'logout',
    open: (p) => p.getByRole('button', { name: BN.logout }).first(),
    setup: async ({ page }) => {
      await page.goto('/settings')
    },
  },
  {
    id: 'profile-edit',
    open: (p) => p.locator(`button[aria-label^="${BN.editProfile}"]:visible`).first(),
    setup: async ({ page }) => {
      await page.goto('/profiles')
    },
  },
  {
    id: 'profile-add',
    inline: true,
    open: (p) => p.getByRole('button', { name: /যোগ করুন|Add/i }).first(),
    setup: async ({ page }) => {
      await page.goto('/profiles')
    },
  },
  {
    id: 'paywall',
    open: (p) => p.getByRole('button', { name: BN.upgrade }).first(),
    setup: async ({ page, phone }) => {
      const user = await db.user.findUniqueOrThrow({ where: { phone: toDbPhone(phone) } })
      await setUserSubscription({ userId: user.id, status: 'FREE' })
      await page.goto('/subscription')
    },
  },
  {
    id: 'more-sheet',
    // eslint-disable-next-line playwright/no-raw-locators -- bottom-nav More sheet trigger, scoped by the nav data attribute
    open: (p) => p.locator('nav[data-bottom-nav] button[aria-haspopup="dialog"]:visible').first(),
    setup: async ({ page }) => {
      // Force phone chrome so the bottom-nav More sheet exists.
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto('/dashboard')
    },
  },
]

for (const c of POPUPS) {
  test.describe(`bengali: pop-up ${c.id}`, () => {
    test('has no English', async ({ newUser }) => {
      const { page, context, phone } = await newUser()
      await ensureUserProfile(phone, { name: 'বাংলা ইউজার', goal: 'track' })
      await suppressAutoPrompts(page)
      await useBengali(context, page)
      if (c.setup) await c.setup({ page, phone, context })
      else await page.goto('/dashboard')
      const trigger = await c.open(page)
      if (c.inline) {
        await expect(trigger).toBeVisible({ timeout: 15_000 })
        await trigger.click()
      } else {
        await openDialog(trigger)
      }
      await page.waitForLoadState('networkidle').catch(() => {}) // let lazy content / transitions settle
      await expectNoEnglish(page, `pop-up ${c.id}`)
    })
  })
}

test.describe('bengali: auto prompts and locks', () => {
  test('late-period alert', async ({ newUser }) => {
    const { page, context, phone } = await newUser()
    const { bangladeshDays } = await import('../../support/bangladesh-day.ts')
    const days = await bangladeshDays()
    const profile = await ensureUserProfile(phone, {
      name: 'বাংলা ইউজার',
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: days.dateOf(days.daysAgo(40)),
    })
    await setPeriodLogs(profile.id, [
      { startDate: days.dateOf(days.daysAgo(40)), endDate: days.dateOf(days.daysAgo(36)) },
    ])
    await useBengali(context, page)
    await page.goto('/dashboard')
    await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 20_000 })
    await expectNoEnglish(page, 'late-period alert')
  })

  test('trial-expired lock', async ({ browser }) => {
    const { context, email } = await createEmailTrialUser(browser, { locale: 'bn-BD' }, { withProfile: true })
    const page = await context.newPage()
    try {
      await db.user.update({
        where: { email },
        data: { emailTrialExpiresAt: new Date(Date.now() - 60_000) },
      })
      // Seed profile name is Latin ("E2E Trial") — allow as user content (API may 402 under trial lock).
      await useBengali(context, page)
      await page.goto('/dashboard')
      await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 20_000 })
      await expectNoEnglish(page, 'trial lock', 'body', ['E2E Trial'])
    } finally {
      await context.close()
    }
  })

  test('onboarding tour', async ({ newUser }) => {
    const { page, context, phone } = await newUser()
    await ensureUserProfile(phone, { name: 'বাংলা ইউজার', dismissTour: false })
    await useBengali(context, page)
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('e2e_tour_armed')) {
        sessionStorage.setItem('e2e_tour_armed', '1')
        sessionStorage.setItem('vesta_replay_tour', '1')
      }
    })
    await page.goto('/dashboard')
    // eslint-disable-next-line playwright/no-raw-locators -- tour dialog has a generated title id; its text is the thing under test
    await expect(page.locator('[role="dialog"][aria-labelledby^="tour-title-"]')).toBeVisible({ timeout: 20_000 })
    await expectNoEnglish(page, 'tour')
  })
})
