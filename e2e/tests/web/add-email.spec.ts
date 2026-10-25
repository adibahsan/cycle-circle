/**
 * W16 — phone user adds and verifies an email via Settings + Mailpit (#133 closes the #121 gap).
 */
import { test, expect } from '../../support/fixtures.ts'
import { extractVerificationCode } from '../../support/bengali.ts'
import { db, ensureUserProfile } from '../../support/db.ts'
import { latestEmailFor } from '../../support/mailpit.ts'
import { suppressAutoPrompts } from '../../support/prompts.ts'
import { newEmail, toDbPhone } from '../../support/users.ts'

test.describe('phone user adds email (W16)', () => {
  test('Settings: request code, verify from Mailpit, email persists after reload', async ({ newUser }) => {
    const { page, phone } = await newUser()
    // Avoid "Email" in the profile name — it collides with getByLabel(/Email/).
    await ensureUserProfile(phone, { name: 'যোগাযোগ ইউজার' })
    await suppressAutoPrompts(page)

    const email = newEmail('add-email')
    await page.goto('/settings')
    await page.getByRole('button', { name: /Add Email|ইমেইল যোগ করুন/i }).click()
    await page.locator('#settings-contact-email').fill(email)

    const since = new Date(Date.now() - 1000)
    await page.getByRole('button', { name: /Send code|কোড পাঠান/i }).click()
    await expect(page.getByText(new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeVisible({
      timeout: 15_000,
    })

    const msg = await latestEmailFor(email, { since })
    const code = extractVerificationCode(msg.text, msg.html)

    // Fill via Digit 1 (paste distributes); then Verify.
    await page.getByRole('textbox', { name: 'Digit 1' }).fill(code)
    await page.getByRole('button', { name: /^Verify$|^যাচাই/i }).click()

    // Client updates after verify — email row replaces the add form; toast confirms.
    await expect(page.getByText(/Email verified and saved|ইমেইল যাচাই করে সংরক্ষণ/i)).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.locator('#settings-contact-email')).toHaveCount(0)

    await page.reload()
    await expect(page.getByText(email)).toBeVisible({ timeout: 15_000 })

    const user = await db.user.findUniqueOrThrow({ where: { phone: toDbPhone(phone) } })
    expect(user.email?.toLowerCase()).toBe(email.toLowerCase())
  })
})
