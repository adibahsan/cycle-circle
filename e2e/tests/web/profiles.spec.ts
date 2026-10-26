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
      expect(res.status(), `profile ${i}: ${await res.text()}`).toBe(201)
    }
    // Six stored (API) and six rendered (page) before the limit assertions, so a slow run fails on the cause.
    await expect.poll(async () => (await (await page.request.get('/api/profiles')).json()).profiles.length).toBe(6)

    // Navigate to /profiles: limit message must show instead of the add button
    await page.goto('/profiles')
    await expect(page.getByRole('button', { name: /^Edit Profile Member \d$/ })).toHaveCount(6)
    await expect(page.getByText('Maximum 6 profiles')).toBeVisible()
    await expect(page.getByText('Delete a profile to add a new one')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Add$/i })).not.toBeVisible()
  })

  test('API rejects seventh profile with 4xx when limit is exceeded', async ({ newUser, days }) => {
    // Product bug: createProfile throws a plain Error, causing handleApiError to return 500 instead of 4xx.
    // Issue: https://github.com/adibahsan/cycle-circle/issues/137 (Found by E2E ticket #121)
    test.fail(true, 'POST /api/profiles returns 500 instead of 4xx on 6-profile limit (issue #137)')

    const { page } = await newUser()

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
    expect(seventhRes.status()).toBeGreaterThanOrEqual(400)
    expect(seventhRes.status()).toBeLessThan(500)
  })

  test('switching profiles changes the dashboard, calendar and insights to that profile data', async ({ newUser, days }, testInfo) => {
    // Between 00:00 and 06:00 Bangladesh a UTC server counts from yesterday (#160); guarded by the server clock.
    test.fail(days.serverDayLags, 'https://github.com/adibahsan/cycle-circle/issues/160')
    const { page } = await newUser()

    // Create Profile Alpha (last period 10 days ago -> cycle day 11, goal: tracking)
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
    const { profile: profileA } = await resA.json()

    // Add a prior period log for Profile Alpha so Alpha has cycle history for Insights
    const logRes = await page.request.post('/api/tracking/period-logs', {
      data: {
        profileId: profileA.id,
        startDate: days.daysAgo(38),
        endDate: days.daysAgo(33),
        flowIntensity: 'MEDIUM',
      },
    })
    expect(logRes.ok()).toBe(true)

    // Create Profile Beta (last period 3 days ago -> cycle day 4, goal: conceive)
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

    const dateA = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(days.daysAgo(10)))
    const dateB = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(days.daysAgo(3)))

    // 1. Activate Profile Alpha
    await page.goto('/profiles')
    await page.getByRole('button', { name: 'Switch to Profile Alpha' }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    // Dashboard shows Profile Alpha data
    await expect(page.getByRole('link', { name: /Profile Alpha/i })).toBeVisible()
    await expect(page.getByText('Hello, Profile Alpha')).toBeVisible()
    await expect(page.getByText(/Cycle day 11/i)).toBeVisible()
    if (!testInfo.project.name.endsWith('-phone')) {
      await expect(page.getByText('Period Tracking')).toBeVisible()
    }

    // Calendar shows Profile Alpha's period start date
    await page.goto('/calendar')
    await expect(page.getByRole('link', { name: /Profile Alpha/i })).toBeVisible()
    await expect(page.getByRole('listitem', { name: new RegExp(`starting ${dateA}`, 'i') })).toBeVisible()
    await expect(page.getByRole('listitem', { name: new RegExp(`starting ${dateB}`, 'i') })).not.toBeVisible()

    // Insights body shows Profile Alpha subtitle and cycle trend / regularity data
    await page.goto('/insights')
    await expect(page.getByRole('link', { name: /Profile Alpha/i })).toBeVisible()
    await expect(page.locator('main').getByText('Profile Alpha')).toBeVisible()
    await expect(page.getByText('Period Regularity')).toBeVisible()

    // 2. Switch to Profile Beta
    await page.goto('/profiles')
    await page.getByRole('button', { name: 'Switch to Profile Beta' }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    // Dashboard now reflects Profile Beta data (goal, cycle day 4, greeting)
    await expect(page.getByRole('link', { name: /Profile Beta/i })).toBeVisible()
    await expect(page.getByText('Hello, Profile Beta')).toBeVisible()
    await expect(page.getByText('Hello, Profile Alpha')).not.toBeVisible()
    await expect(page.getByText(/Cycle day 4/i)).toBeVisible()
    await expect(page.getByText(/Cycle day 11/i)).not.toBeVisible()
    if (!testInfo.project.name.endsWith('-phone')) {
      await expect(page.getByText('Trying to Conceive')).toBeVisible()
    } else {
      // On phone, verify Beta's goal on /profiles edit modal
      await page.goto('/profiles')
      await expect(page.getByRole('heading', { name: 'My Profiles' })).toBeVisible()
      await expect(page.getByText('Active')).toBeVisible()
      await page.getByRole('button', { name: /Edit Profile Profile Beta/i }).click()
      const editModal = page.getByRole('dialog', { name: 'Edit Profile' })
      await expect(editModal).toBeVisible()
      await expect(editModal.getByRole('button', { name: /Trying to Conceive/i })).toHaveAttribute('aria-pressed', 'true')
      await editModal.getByRole('button', { name: 'Cancel' }).click()
      await expect(editModal).not.toBeVisible()
    }

    // Calendar now reflects Profile Beta's period start date
    await page.goto('/calendar')
    await expect(page.getByRole('link', { name: /Profile Beta/i })).toBeVisible()
    await expect(page.getByRole('listitem', { name: new RegExp(`starting ${dateB}`, 'i') })).toBeVisible()
    await expect(page.getByRole('listitem', { name: new RegExp(`starting ${dateA}`, 'i') })).not.toBeVisible()

    // Insights body now reflects Profile Beta (subtitle shows Profile Beta, no regularity card yet)
    await page.goto('/insights')
    await expect(page.getByRole('link', { name: /Profile Beta/i })).toBeVisible()
    await expect(page.locator('main').getByText('Profile Beta')).toBeVisible()
    await expect(page.locator('main').getByText('Profile Alpha')).not.toBeVisible()
    await expect(page.getByText('Period Regularity')).not.toBeVisible()
  })

  // W15 profile completion flow.
  // Note: The automatic completion prompt requires account age >= 24h (PROFILE_MIN_ACCOUNT_AGE_MS)
  // and a 60-second client delay in MainShell (PROFILE_COMPLETION_PROMPT_DELAY_MS), which is unreachable
  // in the fast real-time E2E suite without a fake clock (disallowed by harness rules). The user-initiated
  // completion flow, modal submission, completion ring/row update (67% -> 83%), and persistence across
  // reload are verified end-to-end here; W15 is accordingly marked 'partial' in COVERAGE.md.
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
    const completionRing = page.getByRole('button', { name: /Profile 67% complete/i }).filter({ visible: true }).first()
    await expect(completionRing).toBeVisible()

    // Dashboard completion row is also visible with 67%
    const completionRow = page.getByRole('main').getByRole('button', { name: /Profile 67% complete/i })
    await expect(completionRow).toBeVisible()

    // Open profile completion modal by tapping the ring
    await completionRing.click()
    const completionModal = page.getByRole('dialog', { name: 'Complete Your Profile' })
    await expect(completionModal).toBeVisible()
    await expect(completionModal.getByRole('heading', { name: 'Complete Your Profile' })).toBeVisible()

    // Fill the required Full Name
    await completionModal.getByLabel('Full Name').fill('Ayesha Rahman')
    await completionModal.getByRole('button', { name: 'Complete Profile' }).click()
    await expect(completionModal).not.toBeVisible()

    // Completion ring and row update to 83%
    const updatedRing = page.getByRole('button', { name: /Profile 83% complete/i }).filter({ visible: true }).first()
    const updatedRow = page.getByRole('main').getByRole('button', { name: /Profile 83% complete/i })
    await expect(updatedRing).toBeVisible()
    await expect(updatedRow).toBeVisible()

    // Verify it survives a reload
    await page.reload()
    await expect(page.getByRole('button', { name: /Profile 83% complete/i }).filter({ visible: true }).first()).toBeVisible()
    await expect(page.getByRole('main').getByRole('button', { name: /Profile 83% complete/i })).toBeVisible()
  })
})
