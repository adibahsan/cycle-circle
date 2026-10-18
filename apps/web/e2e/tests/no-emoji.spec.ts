/**
 * Guard for spec #66 (S4): the redesigned portal pages use drawn icons, never emoji.
 * Run: pnpm exec tsx e2e/run.ts e2e/tests/no-emoji.spec.ts
 * Read-only: seed persona, nothing saved.
 */
import { test, expect } from '@playwright/test'
import { DESKTOP, PHONE_375, gotoQuiet, settle } from '../guards/helpers'
import { emojiIn } from '../support/emoji'

const PAGES = ['/dashboard', '/calendar', '/symptoms', '/insights', '/settings', '/profiles', '/subscription'] as const

for (const [label, viewport] of [['desktop', DESKTOP], ['375x667', PHONE_375]] as const) {
  test.describe(`no emoji in portal pages (${label})`, () => {
    test.use({ viewport })

    for (const route of PAGES) {
      test(route, async ({ page }) => {
        await gotoQuiet(page, route)
        await expect(page.locator('main h1').first()).toBeVisible({ timeout: 15_000 })
        await settle(page, 500)
        expect(await emojiIn(page.locator('main'))).toEqual([])
      })
    }
  })
}
