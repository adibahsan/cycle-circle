import { test, expect } from '../../support/fixtures'

test.describe('Profiles management and isolation', () => {
  test('flow: add a profile, rename it, switch to it, delete it; each change survives a reload', async ({ newUser, days }) => {
    const { page } = await newUser()

    // 1. Create primary profile via API and set active profile cookie so user is onboarded
    const createRes = await page.request.post('/api/profiles', {
      data: {
        name: 'Primary Profile',
        relation: 'SELF',
        cycleLength: 28,
        periodLength: 5,
        lastPeriodStart: days.daysAgo(10),
        goal: 'tracking',
      },
    })
    expect(createRes.ok()).toBe(true)

    await page.goto('/profiles')
    await expect(page.getByRole('heading', { name: 'Profiles' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Switch to Primary Profile' })).toBeVisible()

    // 2. Add a new profile via UI
    await page.getByRole('button', { name: /Add/i }).click()
    await page.getByLabel(/^Name$/).fill('Sister Profile')
    await page.getByRole('button', { name: 'Sister' }).click()
    await page.getByLabel(/Last period start/i).fill(days.daysAgo(5))
    await page.getByRole('button', { name: 'Create Profile' }).click()

    // Verify Sister Profile is in the list and survives a reload
    await expect(page.getByRole('button', { name: 'Switch to Sister Profile' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Switch to Sister Profile' })).toBeVisible()

    // 3. Rename the profile
    await page.getByRole('button', { name: 'Edit profile Sister Profile' }).click()
    const editModal = page.getByRole('dialog', { name: 'Edit Profile' })
    await expect(editModal).toBeVisible()
    await editModal.getByLabel(/^Name$/).fill('Sister Renamed')
    await editModal.getByRole('button', { name: 'Save Changes' }).click()
    await expect(editModal).not.toBeVisible()

    // Verify rename persists and survives a reload
    await expect(page.getByRole('button', { name: 'Switch to Sister Renamed' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Switch to Sister Profile' })).not.toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Switch to Sister Renamed' })).toBeVisible()

    // 4. Switch to the newly renamed profile
    await page.getByRole('button', { name: 'Switch to Sister Renamed' }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    // Verify active profile is Sister Renamed on dashboard and survives reload
    await expect(page.getByRole('link', { name: /Sister Renamed/i })).toBeVisible()
    await expect(page.getByText('Hello, Sister Renamed')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('link', { name: /Sister Renamed/i })).toBeVisible()
    await expect(page.getByText('Hello, Sister Renamed')).toBeVisible()

    // 5. Delete the profile (must switch away from it first, since active profile cannot be deleted)
    await page.goto('/profiles')
    await page.getByRole('button', { name: 'Switch to Primary Profile' }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    await page.goto('/profiles')
    await expect(page.getByRole('button', { name: 'Delete Sister Renamed' })).toBeVisible()
    await page.getByRole('button', { name: 'Delete Sister Renamed' }).click()

    const deleteModal = page.getByRole('dialog', { name: 'Remove profile' })
    await expect(deleteModal).toBeVisible()
    await deleteModal.getByRole('button', { name: 'Delete' }).click()
    await expect(deleteModal).not.toBeVisible()

    // Verify profile is deleted and deletion survives a reload
    await expect(page.getByRole('button', { name: 'Switch to Sister Renamed' })).not.toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Switch to Sister Renamed' })).not.toBeVisible()
  })

  test("a seventh profile can't be added; the limit message shows", async ({ newUser, days }) => {
    const { page } = await newUser()

    // Create 6 profiles (maximum allowed)
    for (let i = 1; i <= 6; i++) {
      const res = await page.request.post('/api/profiles', {
        data: {
          name: `Member ${i}`,
          relation: i === 1 ? 'SELF' : 'SISTER',
          cycleLength: 28,
          periodLength: 5,
          lastPeriodStart: days.daysAgo(5 + i),
          goal: 'tracking',
        },
      })
      expect(res.ok()).toBe(true)
    }

    // Navigate to /profiles: limit message must show instead of the add button
    await page.goto('/profiles')
    await expect(page.getByText('Maximum 6 profiles')).toBeVisible()
    await expect(page.getByText('Delete a profile to add a new one')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Add$/i })).not.toBeVisible()

    // API also rejects the seventh profile
    const seventhRes = await page.request.post('/api/profiles', {
      data: {
        name: 'Member 7',
        relation: 'SISTER',
        cycleLength: 28,
        periodLength: 5,
        lastPeriodStart: days.daysAgo(10),
        goal: 'tracking',
      },
    })
    expect(seventhRes.ok()).toBe(false)
    expect(seventhRes.status()).toBe(500)
  })

  test('switching profiles changes the dashboard, calendar and insights to that profile data', async ({ newUser, days }) => {
    const { page } = await newUser()

    // Create Profile Alpha
    const resA = await page.request.post('/api/profiles', {
      data: {
        name: 'Profile Alpha',
        relation: 'SELF',
        cycleLength: 28,
        periodLength: 5,
        lastPeriodStart: days.daysAgo(10),
        goal: 'tracking',
      },
    })
    expect(resA.ok()).toBe(true)

    // Create Profile Beta
    const resB = await page.request.post('/api/profiles', {
      data: {
        name: 'Profile Beta',
        relation: 'WIFE',
        cycleLength: 30,
        periodLength: 4,
        lastPeriodStart: days.daysAgo(3),
        goal: 'conceive',
      },
    })
    expect(resB.ok()).toBe(true)

    // 1. Activate Profile Alpha
    await page.goto('/profiles')
    await page.getByRole('button', { name: 'Switch to Profile Alpha' }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    // Dashboard shows Profile Alpha
    await expect(page.getByRole('link', { name: /Profile Alpha/i })).toBeVisible()
    await expect(page.getByText('Hello, Profile Alpha')).toBeVisible()

    // Calendar shows Profile Alpha
    await page.goto('/calendar')
    await expect(page.getByRole('link', { name: /Profile Alpha/i })).toBeVisible()

    // Insights shows Profile Alpha
    await page.goto('/insights')
    await expect(page.getByRole('link', { name: /Profile Alpha/i })).toBeVisible()

    // 2. Switch to Profile Beta
    await page.goto('/profiles')
    await page.getByRole('button', { name: 'Switch to Profile Beta' }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    // Dashboard now reflects Profile Beta data
    await expect(page.getByRole('link', { name: /Profile Beta/i })).toBeVisible()
    await expect(page.getByText('Hello, Profile Beta')).toBeVisible()
    await expect(page.getByText('Hello, Profile Alpha')).not.toBeVisible()

    // Calendar now reflects Profile Beta
    await page.goto('/calendar')
    await expect(page.getByRole('link', { name: /Profile Beta/i })).toBeVisible()

    // Insights now reflects Profile Beta
    await page.goto('/insights')
    await expect(page.getByRole('link', { name: /Profile Beta/i })).toBeVisible()
  })

  test('flow: fill the profile-completion details; the completion ring and the auto-prompt update', async ({ newUser, days }) => {
    const { page } = await newUser()

    // Create profile without setting user fullName (so fullName is missing, yielding 67% completion)
    const res = await page.request.post('/api/profiles', {
      data: {
        name: 'IncompleteUser',
        relation: 'SELF',
        cycleLength: 28,
        periodLength: 5,
        lastPeriodStart: days.daysAgo(10),
        goal: 'tracking',
      },
    })
    expect(res.ok()).toBe(true)

    await page.goto('/dashboard')

    // The first-run tour automatically opens for a new user on dashboard; skip it
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page.getByRole('heading', { name: 'Welcome to Cycle Circle' })).not.toBeVisible()

    // Profile chip displays the completion ring button with 67% complete
    const completionRing = page.locator('button[data-tour="profile-ring"]:visible')
    await expect(completionRing).toBeVisible()
    await expect(completionRing).toHaveAttribute('aria-label', /Profile 67% complete/i)

    // Dashboard completion pill is also visible with 67%
    const completionRow = page.locator('[data-testid="completion-row"]:visible')
    await expect(completionRow).toBeVisible()
    await expect(completionRow).toContainText('67%')

    // Open profile completion modal by tapping the ring
    await completionRing.click()
    const completionModal = page.getByRole('dialog', { name: 'Complete Your Profile' })
    await expect(completionModal).toBeVisible()
    await expect(completionModal.getByRole('heading', { name: 'Complete Your Profile' })).toBeVisible()

    // Fill the required Full Name
    await completionModal.getByLabel('Full Name').fill('Ayesha Rahman')
    await completionModal.getByRole('button', { name: 'Complete Profile' }).click()
    await expect(completionModal).not.toBeVisible()

    // Completion ring updates to 83%
    await expect(completionRing).toHaveAttribute('aria-label', /Profile 83% complete/i)
    await expect(completionRow).toContainText('83%')

    // Verify it survives a reload
    await page.reload()
    await expect(page.locator('button[data-tour="profile-ring"]:visible')).toHaveAttribute('aria-label', /Profile 83% complete/i)
    await expect(page.locator('[data-testid="completion-row"]:visible')).toContainText('83%')
  })
})
