/**
 * Admin E2E helpers: create throwaway admins in the E2E DB, log in with email +
 * password, and mint a non-admin admin-audience cookie for the forbidden page.
 *
 * Never use the seeded web read-only personas as admins — create admins here.
 * The seeded super admin (`SECRETS.adminEmail`) is fine for `statePath('admin')`
 * read-only sessions; mutating flows should prefer `createAdminUser` + `loginAsAdmin`.
 */
import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import type { APIRequestContext, Browser, BrowserContext, BrowserContextOptions, Page } from '@playwright/test'
import { e2eDb } from './db.ts'
import { SECRETS, URLS } from './slot.ts'

const ADMIN_COOKIE = 'vesta_admin_token'
const ADMIN_AUDIENCE = 'vesta-admin'
/** Matches `APP_ENV=local` on the E2E admin process (`authIssuer()`). */
const ADMIN_ISSUER = 'vesta:local'

export interface AdminCredentials {
  id: string
  email: string
  password: string
}

export interface AdminSession {
  id: string
  email: string
  password: string
  context: BrowserContext
  page: Page
}

let adminEmailCounter = Date.now() % 100_000

/** Unique email in an E2E-only domain (never collides with seed or web personas). */
export function newAdminEmail(prefix = 'admin'): string {
  adminEmailCounter = (adminEmailCounter + 1) % 100_000
  const worker = Number(process.env.TEST_PARALLEL_INDEX ?? 0) % 100
  const nonce = randomBytes(3).toString('hex')
  return `${prefix}-w${worker}-${adminEmailCounter}-${nonce}@e2e.vesta.test`
}

/**
 * Insert a Super Admin into the E2E DB (bcrypt password). Used by later tickets
 * (#127–#131) and by the login flow — not the seeded web read-only users.
 */
export async function createAdminUser(opts: { email?: string; password?: string; fullName?: string } = {}): Promise<AdminCredentials> {
  const email = opts.email ?? newAdminEmail()
  const password = opts.password ?? `E2e-Admin-${randomBytes(6).toString('hex')}!`
  const passwordHash = await bcrypt.hash(password, 12)
  const user = await e2eDb().user.create({
    data: {
      email,
      fullName: opts.fullName ?? 'E2E Admin',
      authMethod: 'EMAIL',
      role: 'ADMIN',
      passwordHash,
      profileCompleted: true,
    },
  })
  return { id: user.id, email, password }
}

/**
 * A non-admin email user with a password hash. Useful for forging an admin-audience
 * JWT with `role=USER` (the login API refuses non-admins).
 */
export async function createNonAdminEmailUser(
  opts: { email?: string; password?: string; fullName?: string } = {},
): Promise<AdminCredentials> {
  const email = opts.email ?? newAdminEmail('user')
  const password = opts.password ?? `E2e-User-${randomBytes(6).toString('hex')}!`
  const passwordHash = await bcrypt.hash(password, 12)
  const user = await e2eDb().user.create({
    data: {
      email,
      fullName: opts.fullName ?? 'E2E Non-Admin',
      authMethod: 'EMAIL',
      role: 'USER',
      passwordHash,
      profileCompleted: true,
      subscriptionStatus: 'FREE',
    },
  })
  return { id: user.id, email, password }
}

/** Real admin login over HTTP; cookies land on `request` (use a BrowserContext's `.request`). */
export async function loginAsAdmin(
  request: APIRequestContext,
  credentials: { email: string; password: string },
): Promise<void> {
  const res = await request.post('/api/auth/login', {
    data: { email: credentials.email, password: credentials.password },
  })
  if (!res.ok()) {
    throw new Error(`admin login failed (${res.status()}): ${await res.text()}`)
  }
}

/** Fill the admin login form and submit (UI path). Lands on `/` when credentials are valid. */
export async function loginAsAdminViaUi(page: Page, credentials: { email: string; password: string }): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Email').fill(credentials.email)
  await page.getByLabel('Password', { exact: true }).fill(credentials.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

/**
 * Sign an admin-audience JWT. Defaults to `role: 'ADMIN'`. Pass `role: 'USER'` to
 * exercise the forbidden page (valid token, wrong role).
 */
export async function signAdminAudienceToken(input: {
  sub: string
  email?: string
  role?: 'ADMIN' | 'USER'
  expirySeconds?: number
}): Promise<string> {
  const secret = new TextEncoder().encode(SECRETS.adminJwt)
  return new SignJWT({
    email: input.email,
    role: input.role ?? 'ADMIN',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.sub)
    .setJti(createHash('sha256').update(`${input.sub}:${Date.now()}`).digest('hex').slice(0, 32))
    .setIssuer(ADMIN_ISSUER)
    .setAudience(ADMIN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${input.expirySeconds ?? 60 * 60}s`)
    .sign(secret)
}

/** Attach `vesta_admin_token` to a context (Secure cookies are accepted on localhost). */
export async function setAdminCookie(context: BrowserContext, token: string): Promise<void> {
  await context.addCookies([
    {
      name: ADMIN_COOKIE,
      value: token,
      url: URLS.admin,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ])
}

/**
 * Fresh browser context logged in as a throwaway admin (DB create + HTTP login).
 * Close the context when done. Prefer this over seeded web personas.
 */
export async function createLoggedInAdmin(
  browser: Browser,
  contextOptions: BrowserContextOptions = {},
  credentials?: AdminCredentials,
): Promise<AdminSession> {
  const admin = credentials ?? (await createAdminUser())
  const context = await browser.newContext({
    baseURL: URLS.admin,
    timezoneId: 'Asia/Dhaka',
    locale: 'en-US',
    ...contextOptions,
  })
  await loginAsAdmin(context.request, admin)
  return { ...admin, context, page: await context.newPage() }
}
