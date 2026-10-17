/**
 * The server renders the user's language (vesta_lang cookie), so Bengali pages hydrate
 * without a mismatch or an English flash. Before this, the server always rendered English
 * and the client switched after the layout hydrated, so React threw away the page tree.
 */
import { test, expect } from '@playwright/test'
import { gotoQuiet } from '../guards/helpers'

test('server renders Bengali from the cookie and hydrates without errors', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'vesta_lang', value: 'bn', url: baseURL! }])
  const html = await (await page.request.get('/dashboard')).text()
  expect(html).toMatch(/<html[^>]*lang="bn"/)
  expect(html).toContain('ড্যাশবোর্ড')

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error' && /hydrat/i.test(m.text())) errors.push(m.text()) })
  await gotoQuiet(page, '/dashboard')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ড্যাশবোর্ড')
  expect(errors.filter((e) => /hydrat/i.test(e))).toEqual([])
})

test('a Bengali choice saved only in localStorage moves into the cookie', async ({ page, context }) => {
  await page.addInitScript(() => {
    if (document.cookie.includes('vesta_lang=')) return
    localStorage.setItem('vesta-store', JSON.stringify({ state: { language: 'bn' }, version: 0 }))
  })
  await gotoQuiet(page, '/dashboard')
  await expect(page.locator('html')).toHaveAttribute('lang', 'bn')
  expect((await context.cookies()).find((c) => c.name === 'vesta_lang')?.value).toBe('bn')
})

test('switching language writes the cookie, so the next server render matches', async ({ page, context }) => {
  await gotoQuiet(page, '/settings')
  await page.getByRole('radio', { name: 'বাং' }).first().click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'bn')
  expect((await context.cookies()).find((c) => c.name === 'vesta_lang')?.value).toBe('bn')
  const html = await (await page.request.get('/settings')).text()
  expect(html).toMatch(/<html[^>]*lang="bn"/)
})
