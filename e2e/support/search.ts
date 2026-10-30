/**
 * Type into a debounced search box until the page's URL shows the filter.
 *
 * Admin list pages push `?search=` (or `?q=`) 300 ms after the last keystroke (#138). On a slow
 * runner the first `fill` can land before React has hydrated the input: the DOM shows the
 * text but no change handler ran, so the URL never updates. This clears and types again until
 * `settled` passes (React's value tracker ignores a re-fill of the same text). No sleeps.
 */
import type { Locator } from '@playwright/test'
import { expect } from './fixtures.ts'

export async function fillSearch(
  input: Locator,
  value: string,
  settled: (timeoutMs: number) => Promise<void>,
): Promise<void> {
  await expect(input).toBeEditable({ timeout: 15_000 })
  let first = true
  await expect(async () => {
    if (!first) await input.fill('')
    first = false
    await input.fill(value)
    await settled(5_000)
  }).toPass({ timeout: 30_000 })
}
