/**
 * Open a pop-up by clicking its trigger, and click again until the dialog shows.
 *
 * Why the retry: on a server whose clock is in UTC (prod, CI) the SSR of the dashboard and
 * calendar can differ from the Asia/Dhaka browser's render (#161: "today" comes from the
 * process clock). React then throws away the server HTML and renders again on the client,
 * and a click that landed on the old DOM before that is lost. A user simply taps again; so
 * does this helper. It never clicks while the dialog is already open.
 */
import type { Locator } from '@playwright/test'
import { expect } from './fixtures.ts'

export async function openDialog(trigger: Locator, dialog: Locator = trigger.page().getByRole('dialog').first()): Promise<Locator> {
  await expect(trigger).toBeVisible({ timeout: 15_000 })
  await expect(async () => {
    if (!(await dialog.isVisible())) await trigger.click({ timeout: 2_000 })
    await expect(dialog).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 20_000 })
  return dialog
}

/**
 * Submit a dialog and wait for it to close.
 *
 * Why wait: the server action's refresh can render the new list row a moment before the dialog
 * closes. A test that opens the next dialog right after seeing the row would type into the old
 * one. Closing is observed by the dialog's heading count reaching 0 (`headingName`).
 *
 * Desktop clicks the button. With `isMobile`, a synthetic click is dispatched instead: sticky
 * chrome or a toast can cover the button on the phone layout, and a hit-tested click is swallowed.
 * Only use this when the submit is expected to succeed; a refused submit keeps the dialog open.
 */
export async function submitDialog(
  dialog: Locator,
  buttonName: string,
  opts: { headingName: string | RegExp; isMobile?: boolean; exact?: boolean; timeout?: number },
): Promise<void> {
  const button = dialog.getByRole('button', { name: buttonName, exact: opts.exact ?? true })
  if (opts.isMobile) await button.dispatchEvent('click')
  else await button.click()
  await expect(dialog.page().getByRole('heading', { name: opts.headingName })).toHaveCount(0, { timeout: opts.timeout ?? 15_000 })
}
