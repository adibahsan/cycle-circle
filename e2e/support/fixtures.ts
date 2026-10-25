/**
 * The suite's `test`: Playwright's, plus
 *   - `fakeBdapps`: control client for the fake BDApps;
 *   - `newUser()`: a throwaway Pro user logged in through the real OTP flow, with a page;
 *   - `days`: Bangladesh days from the server's clock.
 * Every test also gets its own fake client IP (`x-real-ip`), so OTP per-IP limits never
 * leak between tests. Import `test`/`expect` from here, not from @playwright/test.
 */
import { test as base, expect, type BrowserContext, type Page } from '@playwright/test'
import { bangladeshDays, type BangladeshDays } from './bangladesh-day.ts'
import { closeE2eDb } from './db.ts'
import { FakeBdappsClient } from './fake-bdapps.ts'
import { createThrowawayUser, ipFor } from './users.ts'
import { URLS } from './slot.ts'

export interface NewUser {
  phone: string
  context: BrowserContext
  page: Page
}

interface Fixtures {
  fakeBdapps: FakeBdappsClient
  newUser: () => Promise<NewUser>
  days: BangladeshDays
}

interface WorkerFixtures {
  _e2eDbTeardown: undefined
}

export const test = base.extend<Fixtures, WorkerFixtures>({
  _e2eDbTeardown: [
    async ({}, use) => {
      await use(undefined)
      await closeE2eDb()
    },
    { scope: 'worker', auto: true },
  ],

  extraHTTPHeaders: async ({}, use, testInfo) => {
    await use({ 'x-real-ip': ipFor(testInfo.testId) })
  },

  fakeBdapps: async ({}, use) => {
    await use(new FakeBdappsClient())
  },

  newUser: async ({ browser, fakeBdapps, viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId }, use) => {
    const contexts: BrowserContext[] = []
    await use(async () => {
      const { phone, context } = await createThrowawayUser(
        browser,
        { baseURL: URLS.web, viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale, timezoneId },
        fakeBdapps,
      )
      contexts.push(context)
      return { phone, context, page: await context.newPage() }
    })
    await Promise.all(contexts.map((c) => c.close()))
  },

  days: async ({}, use) => {
    await use(await bangladeshDays())
  },
})

export { expect }
