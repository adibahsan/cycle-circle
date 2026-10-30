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
