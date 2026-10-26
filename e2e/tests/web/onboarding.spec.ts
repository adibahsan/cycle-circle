import { test, expect } from '../../support/fixtures'

test.describe('Onboarding wizard and tour', () => {
  test('flow: complete the onboarding wizard; the dashboard reflects the answers', async ({ newUser, days }, testInfo) => {
    // Between 00:00 and 06:00 Bangladesh a UTC server counts from yesterday (#160); guarded by the server clock.
    test.fail(days.serverDayLags, 'https://github.com/adibahsan/cycle-circle/issues/160')
    const { page } = await newUser()

    await page.goto('/onboarding')
    await expect(page.getByRole('heading', { name: 'Welcome to Cycle Circle' })).toBeVisible()

    // Step 1 -> Step 2: Goal
    await page.getByRole('button', { name: 'Get Started' }).click()
    await expect(page.getByRole('heading', { name: 'What is your goal?' })).toBeVisible()

    // Select goal: Trying to Conceive
    await page.getByRole('button', { name: /Trying to Conceive/i }).click()
    await page.getByRole('button', { name: 'Next' }).click()

    // Step 3: Profile Setup
    await expect(page.getByRole('heading', { name: 'Who is this profile for?' })).toBeVisible()
    await page.getByLabel(/Name \*/i).fill('Farhana')
    await page.getByRole('button', { name: 'Next' }).click()

    // Step 4: Cycle History (last period was 10 days ago -> today is cycle day 11)
    await expect(page.getByRole('heading', { name: 'Tell us about your cycle' })).toBeVisible()
    const lastPeriod = days.daysAgo(10)
    await page.getByLabel(/Last period start date \*/i).fill(lastPeriod)
    await page.getByRole('button', { name: 'Next' }).click()

    // Step 5: Summary
    await expect(page.getByRole('heading', { name: "You're all set!" })).toBeVisible()
    await expect(page.getByText('Farhana')).toBeVisible()
    await expect(page.getByText('Trying to Conceive')).toBeVisible()

    // Finish wizard and land on dashboard
    await page.getByRole('button', { name: 'Go to Dashboard' }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    // The first-run tour opens automatically; skip it so it doesn't overlay assertions
    const tourHeading = page.getByRole('heading', { name: 'Welcome to Cycle Circle' })
    await expect(tourHeading).toBeVisible()
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(tourHeading).not.toBeVisible()

    // Dashboard reflects the answers: active profile name, greeting, and cycle day
    await expect(page.getByRole('link', { name: /Farhana/i })).toBeVisible()
    await expect(page.getByText('Hello, Farhana')).toBeVisible()
    await expect(page.getByText(/Cycle day 11/i)).toBeVisible()
    if (!testInfo.project.name.endsWith('-phone')) {
      await expect(page.getByText('Trying to Conceive')).toBeVisible()
    } else {
      // On phone, sidebar is hidden; verify the goal answer on /profiles edit modal
      await page.goto('/profiles')
      await expect(page.getByRole('heading', { name: 'My Profiles' })).toBeVisible()
      await expect(page.getByText('Active')).toBeVisible()
      await page.getByRole('button', { name: /Edit Profile Farhana/i }).click()
      const editModal = page.getByRole('dialog', { name: 'Edit Profile' })
      await expect(editModal).toBeVisible()
      await expect(editModal.getByRole('button', { name: /Trying to Conceive/i })).toHaveAttribute('aria-pressed', 'true')
      await editModal.getByRole('button', { name: 'Cancel' }).click()
      await expect(editModal).not.toBeVisible()
      await page.goto('/dashboard')
    }

    // Verify it survives a reload and tour remains absent
    await page.reload()
    await expect(tourHeading).not.toBeVisible()
    await expect(page.getByRole('link', { name: /Farhana/i })).toBeVisible()
    await expect(page.getByText('Hello, Farhana')).toBeVisible()
    await expect(page.getByText(/Cycle day 11/i)).toBeVisible()
    if (!testInfo.project.name.endsWith('-phone')) {
      await expect(page.getByText('Trying to Conceive')).toBeVisible()
    } else {
      await page.goto('/profiles')
      await expect(page.getByRole('heading', { name: 'My Profiles' })).toBeVisible()
      await expect(page.getByText('Active')).toBeVisible()
      await page.getByRole('button', { name: /Edit Profile Farhana/i }).click()
      const editModal = page.getByRole('dialog', { name: 'Edit Profile' })
      await expect(editModal).toBeVisible()
      await expect(editModal.getByRole('button', { name: /Trying to Conceive/i })).toHaveAttribute('aria-pressed', 'true')
      await editModal.getByRole('button', { name: 'Cancel' }).click()
      await expect(editModal).not.toBeVisible()
    }
  })

  test("the onboarding tour can be finished and replayed, and isn't shown again once finished", async ({ newUser, days }) => {
    const { page } = await newUser()

    // Complete onboarding so the user has a profile and lands on dashboard
    await page.goto('/onboarding')
    await page.getByRole('button', { name: 'Get Started' }).click()
    await page.getByRole('button', { name: /Period Tracking/i }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByLabel(/Name \*/i).fill('TourTester')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByLabel(/Last period start date \*/i).fill(days.daysAgo(7))
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Go to Dashboard' }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    // Onboarding tour automatically opens for the first-run user
    const tourHeading = page.getByRole('heading', { name: 'Welcome to Cycle Circle' })
    await expect(tourHeading).toBeVisible()

    // Walk through all tour steps
    // Step 1: Welcome -> Next
    await page.getByRole('button', { name: 'Next' }).click()
    // Step 2: Log period -> Next
    await expect(page.getByRole('heading', { name: 'Log your period' })).toBeVisible()
    await page.getByRole('button', { name: 'Next' }).click()
    // Step 3: Calendar -> Next
    await expect(page.getByRole('heading', { name: 'Your cycle calendar' })).toBeVisible()
    await page.getByRole('button', { name: 'Next' }).click()
    // Step 4: Insights -> Next
    await expect(page.getByRole('heading', { name: 'Personal insights' })).toBeVisible()
    await page.getByRole('button', { name: 'Next' }).click()
    // Step 5: Profile -> Done
    await expect(page.getByRole('heading', { name: 'Finish your profile' })).toBeVisible()
    await page.getByRole('button', { name: 'Done' }).click()

    // Tour is closed
    await expect(tourHeading).not.toBeVisible()

    // Reload dashboard: tour must NOT be shown again
    await page.reload()
    await expect(page.getByRole('link', { name: /TourTester/i })).toBeVisible()
    await expect(tourHeading).not.toBeVisible()

    // Replay tour from settings
    await page.goto('/settings')
    await page.getByRole('button', { name: /Replay app tour/i }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    // Tour is shown again on replay
    await expect(tourHeading).toBeVisible()

    // Skip the replayed tour
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(tourHeading).not.toBeVisible()

    // Reload again: tour must not reopen
    await page.reload()
    await expect(tourHeading).not.toBeVisible()
  })
})
