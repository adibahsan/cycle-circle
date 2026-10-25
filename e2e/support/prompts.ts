import type { Page } from '@playwright/test'

/**
 * Suppress auto-prompts (late alert, tour, check-in, profile) so flows start from a clean page.
 * The arbiter (apps/web/src/lib/auto-prompt.ts) persists last-shown times in localStorage under keys
 * starting with `vesta_prompt_last:`; this shims localStorage.getItem to report any such key as
 * "shown just now". Explicit user actions (clicking buttons, opening dialogs) are unaffected.
 */
export async function suppressAutoPrompts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      const orig = Storage.prototype.getItem
      Storage.prototype.getItem = function (key: string) {
        if (this === window.localStorage && typeof key === 'string' && key.startsWith('vesta_prompt_last:')) {
          return String(Date.now())
        }
        return orig.call(this, key)
      }
    } catch {}
  })
}
