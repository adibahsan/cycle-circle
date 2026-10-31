/**
 * Helpers for the web-bengali project (#133): set the language cookie + store, then
 * scan visible copy for leftover English (via latin-scan).
 */
import { expect, type BrowserContext, type Page } from '@playwright/test'
import { collectTexts, latinOffenders } from './latin-scan.ts'
import { URLS } from './slot.ts'

/** Bengali UI labels used to open dialogs (from packages/shared i18n bn strings). */
export const BN = {
  logPeriod: 'পিরিয়ড লগ করুন',
  logSymptoms: 'লক্ষণ লগ করুন',
  logout: 'লগ আউট',
  editProfile: 'প্রোফাইল সম্পাদনা',
  addProfile: 'যোগ করুন',
  upgrade: 'প্রো তে আপগ্রেড করুন',
  addEmail: 'ইমেইল যোগ করুন',
  settings: 'সেটিংস',
  dashboard: 'ড্যাশবোর্ড',
} as const

/** Persist Bengali for SSR (cookie) and client (localStorage store). */
export async function useBengali(context: BrowserContext, page: Page): Promise<void> {
  const web = new URL(URLS.web)
  await context.addCookies([
    {
      name: 'vesta_lang',
      value: 'bn',
      domain: web.hostname === 'localhost' ? 'localhost' : web.hostname,
      path: '/',
    },
  ])
  await page.addInitScript(() => {
    try {
      const raw = localStorage.getItem('vesta-store')
      const store = raw ? JSON.parse(raw) : { state: {}, version: 0 }
      store.state = { ...(store.state ?? {}), language: 'bn' }
      localStorage.setItem('vesta-store', JSON.stringify(store))
    } catch {
      /* ignore */
    }
  })
}

/** Profile names the user typed — content, not UI copy. */
export async function userStrings(page: Page): Promise<string[]> {
  try {
    const res = await page.request.get('/api/profiles')
    if (!res.ok()) return []
    const body = (await res.json()) as { profiles?: { name?: string }[] }
    return (body.profiles ?? []).map((p) => p.name ?? '').filter(Boolean)
  } catch {
    return []
  }
}

export async function expectNoEnglish(
  page: Page,
  label: string,
  root = 'body',
  extraUserStrings: string[] = [],
): Promise<void> {
  const names = [...(await userStrings(page)), ...extraUserStrings]
  const bad = latinOffenders(await collectTexts(page, root), names)
  expect(bad.map((b) => `${b.where}: ${JSON.stringify(b.value)}`), `English left on ${label}`).toEqual([])
}

export function extractVerificationCode(text: string, html: string): string {
  const combined = `${text}\n${html}`
  const m = combined.match(/\b(\d{6})\b/)
  if (!m?.[1]) throw new Error('No 6-digit verification code found in email')
  return m[1]
}
