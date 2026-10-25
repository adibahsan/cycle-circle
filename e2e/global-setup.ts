/**
 * Once per run, after the servers are up: check Mailpit, then log in every read-only
 * persona through the real OTP flow and the seeded admin with email + password, saving
 * each one's storage state (`statePath(...)`). A saved state that the app still accepts
 * is reused: logging in again within 60 s would hit the OTP resend cooldown, and a run
 * that kept the DB (E2E_SKIP_RESET=1) keeps the sessions valid.
 */
import fs from 'node:fs'
import { chromium, type Browser } from '@playwright/test'
import { FakeBdappsClient } from './support/fake-bdapps.ts'
import { assertMailpit } from './support/mailpit.ts'
import { PERSONAS, statePath, type PersonaName } from './support/personas.ts'
import { AUTH_DIR, SECRETS, URLS } from './support/slot.ts'
import { ipFor, loginWithOtp } from './support/users.ts'

export default async function globalSetup() {
  await assertMailpit()
  fs.mkdirSync(AUTH_DIR, { recursive: true })
  const fake = new FakeBdappsClient()
  const browser = await chromium.launch()
  try {
    for (const name of Object.keys(PERSONAS) as PersonaName[]) {
      const { phone } = PERSONAS[name]
      if (await stillLoggedIn(browser, statePath(name), URLS.web, '/api/auth/status')) continue
      const context = await browser.newContext({ baseURL: URLS.web, extraHTTPHeaders: { 'x-real-ip': ipFor(phone) } })
      await loginWithOtp(context.request, phone, fake)
      await context.storageState({ path: statePath(name) })
      await context.close()
    }

    if (await stillLoggedIn(browser, statePath('admin'), URLS.admin, '/')) return
    const admin = await browser.newContext({ baseURL: URLS.admin })
    const res = await admin.request.post('/api/auth/login', { data: { email: SECRETS.adminEmail, password: SECRETS.adminPassword } })
    if (!res.ok()) throw new Error(`admin login failed (${res.status()}): ${await res.text()}`)
    await admin.storageState({ path: statePath('admin') })
    await admin.close()
  } finally {
    await browser.close()
  }
}

/** True if `file` exists and its session still opens `path` on `baseURL` without a redirect. */
async function stillLoggedIn(browser: Browser, file: string, baseURL: string, path: string): Promise<boolean> {
  if (!fs.existsSync(file)) return false
  const context = await browser.newContext({ baseURL, storageState: file })
  try {
    const res = await context.request.get(path, { maxRedirects: 0 })
    return res.status() === 200
  } finally {
    await context.close()
  }
}
