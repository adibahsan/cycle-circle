/**
 * Demo Users for handbook capture. Fixed, obviously fake identities, so screenshots never show
 * a random test number. Every one is created in the slot's E2E database through the real login
 * flows (fake BDApps, Mailpit); nothing here can reach production.
 */
import type { Browser, BrowserContext, BrowserContextOptions } from '@playwright/test'
import { db } from '../../support/db.ts'
import { FakeBdappsClient } from '../../support/fake-bdapps.ts'
import { waitForMagicLinkEmail } from '../../support/mailpit.ts'
import { URLS } from '../../support/slot.ts'
import { ipFor, loginWithOtp } from '../../support/users.ts'

/** Phone numbers for the demo Users (not in the seed, not in the E2E suite's 0136 range). */
export const DEMO_PHONES = { loginFlow: '01711223344', onboarding: '01711223355' } as const

type ContextOptions = BrowserContextOptions

function freshContext(browser: Browser, options: ContextOptions, key: string): Promise<BrowserContext> {
  return browser.newContext({
    baseURL: URLS.web,
    timezoneId: 'Asia/Dhaka',
    locale: 'en-US',
    ...options,
    extraHTTPHeaders: { ...options.extraHTTPHeaders, 'x-real-ip': ipFor(key) },
  })
}

/** A new Pro User (verified phone) with no profile yet, logged in through the real OTP flow. */
export async function demoPhoneUser(browser: Browser, options: ContextOptions, phone: string): Promise<BrowserContext> {
  const context = await freshContext(browser, options, phone)
  await loginWithOtp(context.request, phone, new FakeBdappsClient())
  return context
}

/** An email-trial User named Rina with a profile, logged in through the real magic-link flow. */
export async function demoEmailTrialUser(browser: Browser, options: ContextOptions, email: string): Promise<BrowserContext> {
  await db.user.create({
    data: {
      email,
      authMethod: 'EMAIL',
      emailTrialExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      profiles: { create: { name: 'Rina', relation: 'SELF', cycleLength: 28, periodLength: 5 } },
    },
  })
  const context = await freshContext(browser, options, email)
  const since = new Date(Date.now() - 1000)
  const sent = await context.request.post('/api/auth/magic-link/request', { data: { email } })
  if (!sent.ok()) throw new Error(`magic link request failed (${sent.status()})`)
  const { callbackUrl } = await waitForMagicLinkEmail(email, { since })
  const done = await context.request.get(callbackUrl)
  if (!done.ok()) throw new Error(`magic link callback failed (${done.status()})`)
  return context
}
