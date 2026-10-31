import type { Page } from '@playwright/test'
import { test, expect } from '../../support/fixtures'
import { createLoggedInAdmin } from '../../support/admin'
import { createEmailTrialUser } from '../../support/users'
import { e2eDb, revalidateWebTags } from '../../support/db'
import { useBengali } from '../../support/bengali'

// #203. The Pro price is global, so this spec runs in the serial `cron` project (see README): it is
// the only writer of the price in effect today. It adds rows through the admin System page and, in
// finally, deletes every admin-set row, which puts today's price back to the seeded 5 taka per day.

async function setPriceInAdmin(page: Page, amount: string, period: 'Daily' | 'Weekly' | 'Monthly') {
  await page.goto('/system')
  await page.getByLabel('Amount (taka)').fill(amount)
  await page.getByRole('combobox', { name: 'Period' }).click()
  await page.getByRole('option', { name: period, exact: true }).click()
  await page.getByRole('button', { name: 'Set price', exact: true }).click()
  await expect(page.getByText(/^Pro price set to /)).toBeVisible()
}

test.describe('Customers see the admin-set Pro price', () => {
  test('flow: the subscription page, upgrade confirmation and Terms show it in English and Bangla, and a change shows without a redeploy', async ({
    browser,
  }) => {
    test.slow()
    const admin = await createLoggedInAdmin(browser)
    const { context } = await createEmailTrialUser(browser, {}, { withProfile: true })
    const page = await context.newPage()

    try {
      // The seeded price shows to start with
      await page.goto('/subscription')
      await expect(page.getByText('/day', { exact: true })).toBeVisible()
      await expect(page.getByText('৳5', { exact: true })).toBeVisible()

      // An admin-set price (7.5 taka a day) shows on the subscription page, the confirmation and the Terms
      await setPriceInAdmin(admin.page, '7.5', 'Daily')
      await page.goto('/subscription')
      await expect(page.getByText('৳7.5', { exact: true })).toBeVisible()
      await expect(page.getByText('/day', { exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Upgrade to Pro' }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByText('By confirming, ৳7.5 will be deducted from your mobile balance every day.')).toBeVisible()
      await page.keyboard.press('Escape')
      await page.goto('/terms')
      await expect(page.getByText('Cycle Circle Pro costs ৳7.5/day', { exact: false })).toBeVisible()
      await expect(page.getByText(/CAAS|Aggregation/)).toHaveCount(0)

      // A change updates the pages without a redeploy
      await setPriceInAdmin(admin.page, '35', 'Weekly')
      await page.goto('/subscription')
      await expect(page.getByText('৳35', { exact: true })).toBeVisible()
      await expect(page.getByText('/week', { exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Upgrade to Pro' }).click()
      await expect(page.getByRole('dialog').getByText('By confirming, ৳35 will be deducted from your mobile balance every week.')).toBeVisible()
      await page.keyboard.press('Escape')

      // Bangla uses Bangla numerals and words
      await useBengali(context, page)
      await page.goto('/subscription')
      await expect(page.getByText('৳৩৫', { exact: true })).toBeVisible()
      await expect(page.getByText('/সপ্তাহ', { exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'প্রো তে আপগ্রেড করুন' }).click()
      await expect(
        page.getByRole('dialog').getByText('নিশ্চিত করলে প্রতি সপ্তাহ আপনার মোবাইল ব্যালেন্স থেকে ৳৩৫ কাটা হবে।'),
      ).toBeVisible()
      await page.keyboard.press('Escape')
      await page.goto('/terms')
      await expect(page.getByText('৳৩৫/সপ্তাহ', { exact: false })).toBeVisible()
      await expect(page.getByText(/CAAS|অ্যাগ্রিগেশন/)).toHaveCount(0)
    } finally {
      await e2eDb().proPrice.deleteMany({ where: { createdBy: { not: null } } })
      await revalidateWebTags(['pro-price'])
      await context.close()
      await admin.context.close()
    }
  })
})
