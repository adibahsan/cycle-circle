import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { test, expect } from '../../support/fixtures.ts'
import { createProfileWithLogs, getDb } from '../../support/db.ts'
import { latestEmailFor } from '../../support/mailpit.ts'
import { SECRETS, URLS } from '../../support/slot.ts'

test.describe('Settings and Account', () => {
  test('the theme toggle switches and remembers light and dark', async ({ newUser }) => {
    const { page } = await newUser()
    await page.goto('/settings')

    // Switch to dark theme via segmented control
    await page.getByRole('radio', { name: /Dark/i }).click()
    await expect(page.getByRole('radio', { name: /Dark/i })).toBeChecked()
    await expect(page.locator('html')).toHaveClass(/dark/)

    // Survives reload
    await page.reload()
    // Wait for Zustand persisted state to rehydrate
    await expect(page.getByRole('radio', { name: /Dark/i })).toBeChecked()
    await expect(page.locator('html')).toHaveClass(/dark/)

    // Switch back to light theme
    await page.getByRole('radio', { name: /Light/i }).click()
    await expect(page.getByRole('radio', { name: /Light/i })).toBeChecked()
    await expect(page.locator('html')).not.toHaveClass(/dark/)

    // Survives reload
    await page.reload()
    await expect(page.getByRole('radio', { name: /Light/i })).toBeChecked()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })

  test('the language switch works on logged-in settings and survives reload', async ({ newUser }) => {
    const { page, context } = await newUser()
    await page.goto('/settings')

    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()

    // Switch to Bengali (বাং)
    await page.getByRole('radio', { name: 'বাং' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'সেটিংস' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'বাং' })).toBeChecked()
    expect((await context.cookies()).find((c) => c.name === 'vesta_lang')?.value).toBe('bn')

    // Reload — server renders Bengali
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'সেটিংস' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'বাং' })).toBeChecked()

    // Switch back to English (in Bengali UI, the short code for English is "ইং")
    await page.getByRole('radio', { name: /^(EN|ইং)$/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
    await expect(page.getByRole('radio', { name: /^(EN|ইং)$/ })).toBeChecked()
    expect((await context.cookies()).find((c) => c.name === 'vesta_lang')?.value).toBe('en')

    // Reload — server renders English
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
    await expect(page.getByRole('radio', { name: /^(EN|ইং)$/ })).toBeChecked()
  })

  test('change notification preferences and opt out of reminders; choice survives reload and cron skips user', async ({ newUser }) => {
    const { page, phone } = await newUser()

    // Seed profile with notification preferences
    const db = getDb()
    const dbUser = await db.user.findFirstOrThrow({
      where: { phone: { contains: phone.slice(1) } },
    })
    await createProfileWithLogs({ userId: dbUser.id, profileName: 'Reminder Test Profile' })

    await page.goto('/settings')

    // Verify initial toggle states
    const periodToggle = page.getByRole('switch', { name: 'Period Alerts' })
    const fertileToggle = page.getByRole('switch', { name: 'Fertile Window Alerts' })
    const loggingToggle = page.getByRole('switch', { name: 'Logging Reminders' })
    const completionToggle = page.getByRole('switch', { name: 'Profile-completion reminders' })

    await expect(periodToggle).toBeChecked()
    await expect(fertileToggle).toBeChecked()
    await expect(loggingToggle).toBeChecked()
    await expect(completionToggle).toBeChecked()

    // Opt out of all notifications and reminders
    await periodToggle.click()
    await fertileToggle.click()
    await loggingToggle.click()
    await completionToggle.click()

    await expect(periodToggle).not.toBeChecked()
    await expect(fertileToggle).not.toBeChecked()
    await expect(loggingToggle).not.toBeChecked()
    await expect(completionToggle).not.toBeChecked()

    // Wait for debounce and toast save to server
    await expect(page.getByText('Preferences saved').first()).toBeVisible()
    await page.waitForTimeout(1000)

    // Reload and verify choices survived
    await page.reload()
    await expect(page.getByRole('switch', { name: 'Period Alerts' })).not.toBeChecked()
    await expect(page.getByRole('switch', { name: 'Fertile Window Alerts' })).not.toBeChecked()
    await expect(page.getByRole('switch', { name: 'Logging Reminders' })).not.toBeChecked()
    await expect(page.getByRole('switch', { name: 'Profile-completion reminders' })).not.toBeChecked()

    // Verify DB state
    const updatedUser = await db.user.findUniqueOrThrow({ where: { id: dbUser.id } })
    expect(updatedUser.profileReminderOptOut).toBe(true)

    // Invoke daily reminders cron with CRON_SECRET for this opted-out user
    const cronRes = await page.request.post(`${URLS.web}/api/cron/daily-reminders`, {
      headers: { authorization: `Bearer ${SECRETS.cronSecret}` },
      data: { userId: dbUser.id, force: true },
    })
    expect(cronRes.ok()).toBe(true)
    const result = (await cronRes.json()) as {
      periodAlerts: number
      fertileAlerts: number
      reminders: number
      completionReminders: number
      errors: number
    }

    // Skipped: 0 reminders sent to this user
    expect(result.periodAlerts).toBe(0)
    expect(result.fertileAlerts).toBe(0)
    expect(result.reminders).toBe(0)
    expect(result.completionReminders).toBe(0)
    expect(result.errors).toBe(0)

    // No emails logged in database for this user
    const emails = await db.emailLog.findMany({ where: { userId: dbUser.id } })
    expect(emails).toHaveLength(0)
  })

  test('export data as CSV and XLSX; both files contain the logged entries', async ({ newUser }) => {
    const { page, phone } = await newUser()

    const db = getDb()
    const dbUser = await db.user.findFirstOrThrow({
      where: { phone: { contains: phone.slice(1) } },
    })

    const uniqueProfileName = `ExportUser-${Date.now()}`
    const uniqueSymptomId = `cramps-e2e-${Date.now()}`
    await createProfileWithLogs({
      userId: dbUser.id,
      profileName: uniqueProfileName,
      flowIntensity: 'HEAVY',
      symptomId: uniqueSymptomId,
    })

    await page.goto('/settings')

    // 1. Export CSV
    const csvDownloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export as CSV' }).click()
    const csvDownload = await csvDownloadPromise
    expect(csvDownload.suggestedFilename()).toMatch(/vesta-export-.*\.csv$/)

    const csvPath = await csvDownload.path()
    expect(csvPath).not.toBeNull()
    const csvContent = fs.readFileSync(csvPath!, 'utf8')
    expect(csvContent).toContain('=== PERIOD LOGS ===')
    expect(csvContent).toContain('=== SYMPTOM LOGS ===')
    expect(csvContent).toContain(uniqueProfileName)
    expect(csvContent).toContain('HEAVY')
    expect(csvContent).toContain(uniqueSymptomId)

    // 2. Export Excel
    const xlsxDownloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export as Excel' }).click()
    const xlsxDownload = await xlsxDownloadPromise
    expect(xlsxDownload.suggestedFilename()).toMatch(/vesta-export-.*\.xlsx$/)

    const xlsxPath = await xlsxDownload.path()
    expect(xlsxPath).not.toBeNull()

    // Unzip and inspect XML sheet contents for the logged entries
    const xlsxDump = execFileSync('unzip', ['-p', xlsxPath!]).toString('utf8')
    expect(xlsxDump).toContain(uniqueProfileName)
    expect(xlsxDump).toContain('HEAVY')
    expect(xlsxDump).toContain(uniqueSymptomId)
  })

  test('update name and contact details; they show after reload', async ({ newUser }) => {
    const { page, phone } = await newUser()

    const db = getDb()
    const dbUser = await db.user.findFirstOrThrow({
      where: { phone: { contains: phone.slice(1) } },
    })
    const initialProfileName = `Profile-${Date.now()}`
    await createProfileWithLogs({
      userId: dbUser.id,
      profileName: initialProfileName,
    })

    await page.goto('/settings')

    // 1. Contact details: Add Email
    await page.getByRole('button', { name: 'Add Email' }).click()
    const newEmail = `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
    await page.getByPlaceholder('Enter email address…').fill(newEmail)

    const since = new Date()
    await page.getByRole('button', { name: 'Send code' }).click()

    // Receive code in Mailpit
    const message = await latestEmailFor(newEmail, { since, timeoutMs: 10_000 })
    const match = message.text.match(/\b\d{6}\b/)
    expect(match).not.toBeNull()
    const code = match![0]

    // Fill OTP digits and verify
    await page.getByRole('textbox', { name: 'Digit 1' }).fill(code)
    await page.getByRole('button', { name: 'Verify' }).click()
    await expect(page.getByText('Email verified and saved')).toBeVisible()

    // Reload settings — email persists
    await page.reload()
    await expect(page.getByText(newEmail)).toBeVisible()

    // 2. Name: Edit profile name
    await page.goto('/profiles')
    await page.waitForLoadState('networkidle').catch(() => {})
    await expect(page.locator('main').getByText(initialProfileName)).toBeVisible()

    const editBtn = page.getByRole('button', { name: new RegExp(`Edit Profile.*${initialProfileName}`, 'i') })
    await expect(editBtn).toBeVisible()
    await page.waitForTimeout(500)
    await editBtn.click()
    await expect(page.getByRole('dialog')).toBeVisible()

    const updatedName = `Renamed-${Date.now()}`
    await page.locator('#edit-profile-name').fill(updatedName)
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    // Verify updated name shows in profile list
    await expect(page.locator('main').getByText(updatedName)).toBeVisible()

    // Reload profiles — new name persists
    await page.reload()
    await expect(page.locator('main').getByText(updatedName)).toBeVisible()
  })
})
