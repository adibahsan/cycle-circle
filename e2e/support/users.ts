/**
 * Throwaway users and the real OTP login.
 *
 * Phone range: E2E owns `0136XXXXXXX` (11 digits). The existing apps/web suite uses
 * `017000000xx` / `0170000077x-078x`, backend tests use `01700…`, `01805…`, `019x0…`,
 * `0181x…`, `0171x…`; nothing else uses `0136`.
 */
import { createHash, randomBytes } from 'node:crypto'
import type { APIRequestContext, Browser, BrowserContext, BrowserContextOptions } from '@playwright/test'
import { FakeBdappsClient } from './fake-bdapps.ts'
import { SLOT, URLS } from './slot.ts'
import { waitForMagicLinkEmail } from './mailpit.ts'

const E2E_PREFIX = '0136'
// Two digits of Playwright worker + five of a counter seeded from the clock: unique within a
// run across workers, and unlikely to repeat across runs even when the database isn't reset.
const worker = Number(process.env.TEST_PARALLEL_INDEX ?? 0) % 100
let counter = Date.now() % 100_000

/** A phone number (`0136…`, the form a user types) that no other test in this run uses. */
export function newPhone(): string {
  counter = (counter + 1) % 100_000
  return `${E2E_PREFIX}${String(worker).padStart(2, '0')}${String(counter).padStart(5, '0')}`
}

/** Typed `01…` / `+8801…` → DB storage form `+8801…` (same rules as `validateMsisdn`). */
export function toDbPhone(phone: string): string {
  const m = phone.replace(/\s+/g, '').match(/^(?:\+?88)?0?(1[3-9]\d{8})$/)
  if (!m) throw new Error(`not a Bangladeshi MSISDN: ${phone}`)
  return `+880${m[1]}`
}

/**
 * A stable fake client IP for a key (a phone or a test id). The web app rate-limits OTP
 * sends per IP (10 an hour) and trusts `x-real-ip`, so each user/test gets its own bucket.
 */
export function ipFor(key: string): string {
  const h = createHash('sha256').update(key).digest()
  return `10.${h[0]}.${h[1]}.${h[2] || 1}`
}

/**
 * Log `phone` in through the real OTP API: request a code, read it from the fake BDApps,
 * verify it. Cookies land in `request` (use a BrowserContext's `.request` to log the
 * context in). A new number becomes a subscriber; an existing one gets an App OTP.
 */
export async function loginWithOtp(request: APIRequestContext, phone: string, fake = new FakeBdappsClient()): Promise<void> {
  const since = new Date(Date.now() - 1000)
  const sent = await request.post('/api/auth/otp/request', { data: { phone } })
  if (!sent.ok()) throw new Error(`OTP request for ${phone} failed (${sent.status()}): ${await sent.text()}`)
  const { referenceNo } = (await sent.json()) as { referenceNo: string }
  const otp = await fake.latestOtp(phone, { since })
  const verified = await request.post('/api/auth/otp/verify', { data: { referenceNo, otp: otp.code } })
  if (!verified.ok()) throw new Error(`OTP verify for ${phone} failed (${verified.status()}): ${await verified.text()}`)
}

export interface ThrowawayUser {
  phone: string
  context: BrowserContext
}

/**
 * A brand-new user with a unique phone, logged in through the real OTP flow (so a Pro
 * subscriber with no profile yet), in a fresh browser context with the suite's defaults.
 * Close the context when done (the `newUser` fixture does it for you).
 */
export async function createThrowawayUser(
  browser: Browser,
  contextOptions: BrowserContextOptions = {},
  fake = new FakeBdappsClient(),
): Promise<ThrowawayUser> {
  const phone = newPhone()
  const context = await browser.newContext({
    baseURL: URLS.web,
    timezoneId: 'Asia/Dhaka',
    locale: 'en-US',
    ...contextOptions,
    extraHTTPHeaders: { ...contextOptions.extraHTTPHeaders, 'x-real-ip': ipFor(phone) },
  })
  await loginWithOtp(context.request, phone, fake)
  return { phone, context }
}

export interface EmailTrialUser {
  email: string
  context: BrowserContext
}

export interface EmailTrialOptions {
  /** Seed a profile so the user lands on the dashboard instead of onboarding. */
  withProfile?: boolean
}

/** A unique, throwaway email. The magic-link rate limit is 3/hour per address, and Mailpit is shared. */
export function newEmail(prefix = 'e2e-trial'): string {
  return `${prefix}-s${SLOT}-${newPhone()}-${randomBytes(3).toString('hex')}@example.com`
}

/**
 * Create an email-trial user with a profile in the slot DB BEFORE their first magic-link
 * login. The app caches a user's profile list when it first renders `/`, so a profile
 * added after login would not show; seeding first makes the login land on the dashboard.
 */
export async function preseedEmailTrialUser(email: string): Promise<void> {
  const { db } = await import('./db.ts')
  await db.user.create({
    data: {
      email,
      authMethod: 'EMAIL',
      emailTrialExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      profiles: { create: { name: 'E2E Trial', relation: 'SELF', cycleLength: 28, periodLength: 5 } },
    },
  })
}

/**
 * A brand-new user with a unique email, logged in through the real magic-link flow (a FREE
 * user on a 24h email trial), in a fresh browser context with the suite's defaults. Never
 * log seeded users in this way: it burns their per-email rate limit. With
 * `{ withProfile: true }` the user and a profile are seeded in the slot DB first, so the
 * login lands on the dashboard. Close the context when done.
 */
export async function createEmailTrialUser(
  browser: Browser,
  contextOptions: BrowserContextOptions = {},
  { withProfile = false }: EmailTrialOptions = {},
): Promise<EmailTrialUser> {
  const email = newEmail()
  const context = await browser.newContext({
    baseURL: URLS.web,
    timezoneId: 'Asia/Dhaka',
    locale: 'en-US',
    ...contextOptions,
    extraHTTPHeaders: { ...contextOptions.extraHTTPHeaders, 'x-real-ip': ipFor(email) },
  })

  try {
    if (withProfile) await preseedEmailTrialUser(email)
    const since = new Date(Date.now() - 1000)
    const sent = await context.request.post('/api/auth/magic-link/request', { data: { email } })
    if (!sent.ok()) throw new Error(`Magic-link request for ${email} failed (${sent.status()}): ${await sent.text()}`)
    const { callbackUrl } = await waitForMagicLinkEmail(email, { since })
    const done = await context.request.get(callbackUrl)
    if (!done.ok()) throw new Error(`Magic-link callback for ${email} failed (${done.status()}): ${await done.text()}`)
  } catch (e) {
    await context.close()
    throw e
  }

  return { email, context }
}
