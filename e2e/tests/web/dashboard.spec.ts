import { test, expect } from '../../support/fixtures.ts'
import { ensureUserProfile, setPeriodLogs, setPrediction, setSymptomLogs } from '../../support/db.ts'
import { suppressAutoPrompts } from '../../support/prompts.ts'

test.describe('Dashboard modes', () => {
  test('first-run dashboard shows first-period hero and example cycle', async ({ newUser }) => {
    const { page, phone } = await newUser()
    await ensureUserProfile(phone, {
      name: 'First Run User',
      goal: 'track',
      lastPeriodStart: null,
    })

    await page.goto('/dashboard')

    const hero = page.getByRole('region', { name: 'When did your last period start?' })
    await expect(hero).toBeVisible()
    const logButton = hero.getByRole('button', { name: 'Log period' })
    await expect(logButton).toBeVisible()

    // Stepper and ring show example cycle, announced as example.
    // data-testid is kept because the inner <ol> stepper element has no separate accessible role/name.
    const journey = page.getByTestId('cycle-journey')
    await expect(journey).toBeVisible()
    await expect(journey).toHaveAttribute('data-example', 'true')
    await expect(page.getByRole('img', { name: /^Example: cycle day \d+ of 28, not your data$/ })).toBeVisible()

    // No real stats list (prefer accessible name/role, #123 Finding 10)
    await expect(page.getByRole('list', { name: 'Today at a glance' })).toHaveCount(0)
  })

  test('pregnancy dashboard pauses cycle predictions and offers symptom logging', async ({ newUser, days }) => {
    const { page, phone } = await newUser()
    await ensureUserProfile(phone, {
      name: 'Pregnancy User',
      goal: 'pregnant',
      lastPeriodStart: days.dateOf(days.daysAgo(40)),
    })

    await page.goto('/dashboard')

    const hero = page.getByRole('region', { name: 'Pregnancy tracking is coming soon' })
    await expect(hero).toBeVisible()
    await expect(hero.getByRole('button', { name: 'Log symptoms' })).toBeVisible()

    // Prediction cards, cycle journey and progress ring are hidden (prefer accessible name/role, #123 Finding 10)
    await expect(page.getByRole('list', { name: 'Today at a glance' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Cycle journey' })).toHaveCount(0)
    await expect(page.locator('main')).not.toContainText(/fertile|ovulation|next period/i)
  })

  test('menopause dashboard displays days since last period and symptom pattern card', async ({ newUser, days }) => {
    const { page, phone } = await newUser()
    const profile = await ensureUserProfile(phone, {
      name: 'Menopause User',
      goal: 'menopause',
      cycleLength: 90,
      lastPeriodStart: new Date(`${days.daysAgo(50)}T12:00:00.000Z`),
    })

    await setSymptomLogs(profile.id, [
      { date: days.dateOf(days.daysAgo(10)), category: 'PHYSICAL', symptomId: 'hot-flashes' },
      { date: days.dateOf(days.daysAgo(12)), category: 'PHYSICAL', symptomId: 'hot-flashes' },
      { date: days.dateOf(days.daysAgo(5)), category: 'MOOD', symptomId: 'mood-swings' },
    ])

    await page.goto('/dashboard')

    const hero = page.getByRole('region', { name: /Menopause User/ })
    await expect(hero).toBeVisible()
    await expect(hero.getByRole('heading', { name: /Menopause User/ })).toBeVisible()

    // Stat card shows days since last period (exact count: next test; #123 Finding 6 & 10)
    const statsList = page.getByRole('list', { name: 'Today at a glance' })
    await expect(statsList).toBeVisible()
    await expect(statsList).toContainText(/\d+ days since your last period/)

    // Rail shows symptom pattern card with ordered symptom counts incl. Mood Swings (#123 Finding 6)
    const patternCard = page.getByRole('region', { name: 'Your symptom pattern' })
    await expect(patternCard).toBeVisible()
    await expect(patternCard.getByRole('heading', { name: 'Your symptom pattern' })).toBeVisible()

    const symptomItems = patternCard.locator('li')
    await expect(symptomItems).toHaveCount(2)
    await expect(symptomItems.nth(0)).toContainText('Hot Flashes')
    await expect(symptomItems.nth(0)).toContainText(/Logged 2 times/i)
    await expect(symptomItems.nth(1)).toContainText('Mood Swings')
    await expect(symptomItems.nth(1)).toContainText(/Logged 1 time/i)
  })

  // https://github.com/adibahsan/cycle-circle/issues/151: the period log derived from lastPeriodStart keeps
  // its stored UTC-midnight day under any server timezone (E2E_APP_TZ), so the count is exact.
  test('menopause hero counts exact Bangladesh days since the last period', async ({ newUser, days }) => {
    const { page, phone } = await newUser()
    await ensureUserProfile(phone, {
      name: 'Menopause Exact',
      goal: 'menopause',
      cycleLength: 90,
      lastPeriodStart: days.dateOf(days.daysAgo(50)),
    })
    await page.goto('/dashboard')
    await expect(page.getByRole('list', { name: 'Today at a glance' })).toContainText('50 days since your last period')
  })

  test('standard dashboard displays cycle day hero, live cycle journey and ring', async ({ newUser, days }) => {
    // Between 00:00 and 06:00 Bangladesh a UTC server counts from yesterday (#160); guarded by the server clock.
    test.fail(days.serverDayLags, 'https://github.com/adibahsan/cycle-circle/issues/160')
    const { page, phone } = await newUser()
    const profile = await ensureUserProfile(phone, {
      name: 'Standard User',
      goal: 'track',
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: days.dateOf(days.daysAgo(10)),
    })

    await setPeriodLogs(profile.id, [
      {
        startDate: days.dateOf(days.daysAgo(10)),
        endDate: days.dateOf(days.daysAgo(6)),
        flowIntensity: 'MEDIUM',
      },
    ])

    await setPrediction(profile.id, {
      tier: 'AVERAGE',
      nextPeriodStart: days.dateOf(days.daysFromNow(18)),
      ovulationDay: days.dateOf(days.daysFromNow(4)),
      fertileStart: days.dateOf(days.daysAgo(1)),
      fertileEnd: days.dateOf(days.daysFromNow(5)),
      confidence: 0.7,
    })

    await page.goto('/dashboard')

    // Standard hero greetings and stats using role and accessible name (#123 Finding 10)
    await expect(page.getByText('Hello, Standard User')).toBeVisible()
    const statsList = page.getByRole('list', { name: 'Today at a glance' })
    await expect(statsList).toBeVisible()
    await expect(statsList).toContainText('Cycle day 11')
    await expect(statsList).toContainText('Fertile window open')
    await expect(statsList).toContainText('Next period in 18 days')

    // Live cycle journey and progress ring
    const journeySection = page.getByRole('region', { name: 'Cycle journey' })
    await expect(journeySection).toBeVisible()
    // data-testid is kept because the inner <ol> stepper element has no separate accessible role/name.
    const journey = page.getByTestId('cycle-journey')
    await expect(journey).toBeVisible()
    // eslint-disable-next-line playwright/no-raw-locators -- Playwright's getByRole has no aria-current option (journey step)
    await expect(journey.locator('[aria-current="step"]')).toBeVisible()
    await expect(page.getByRole('img', { name: /^Cycle day \d+ of \d+$/ })).toBeVisible()
  })
})

test.describe('Late-period alert', () => {
  test('late-period alert opens with the right day count', async ({ newUser, days }) => {
    // Between 00:00 and 06:00 Bangladesh a UTC server counts from yesterday (#160); guarded by the server clock.
    test.fail(days.serverDayLags, 'https://github.com/adibahsan/cycle-circle/issues/160')
    const { page, phone } = await newUser()
    const profile = await ensureUserProfile(phone, {
      name: 'Late Period User',
      goal: 'track',
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: days.dateOf(days.daysAgo(31)),
    })

    await setPeriodLogs(profile.id, [
      {
        startDate: days.dateOf(days.daysAgo(31)),
        endDate: days.dateOf(days.daysAgo(27)),
        flowIntensity: 'MEDIUM',
      },
    ])

    // Prediction: period was expected 3 days ago
    await setPrediction(profile.id, {
      tier: 'AVERAGE',
      nextPeriodStart: days.dateOf(days.daysAgo(3)),
      ovulationDay: days.dateOf(days.daysAgo(17)),
      fertileStart: days.dateOf(days.daysAgo(22)),
      fertileEnd: days.dateOf(days.daysAgo(16)),
      confidence: 0.75,
    })

    await page.goto('/dashboard')

    // Auto-prompt dialog opens
    const modalHeading = page.getByRole('heading', { name: 'Your period is running late' })
    await expect(modalHeading).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('dialog')).toHaveAccessibleDescription(/It's 3 days past your prediction/)

    const logCta = page.getByRole('button', { name: 'Log my period' })
    await expect(logCta).toBeVisible()
    const laterBtn = page.getByRole('button', { name: 'Maybe later' })
    await expect(laterBtn).toBeVisible()

    // Dismiss the alert modal
    await laterBtn.click()
    await expect(modalHeading).toBeHidden()

    // Hero stat shows late period count (prefer accessible role/name, #123 Finding 10)
    const statsList = page.getByRole('list', { name: 'Today at a glance' })
    await expect(statsList).toContainText('Period 3 days late')
  })
})

test.describe('Streak badge and engagement tracking', () => {
  test('streak badge increases after logging on consecutive Bangladesh days', async ({ newUser, days }) => {
    // Guard against running across the midnight boundary in Asia/Dhaka (UTC+6) (#123 Finding 9)
    const dhakaMsIntoDay = (days.now.getTime() + 6 * 3600 * 1000) % (24 * 3600 * 1000)
    const msToDhakaMidnight = 24 * 3600 * 1000 - dhakaMsIntoDay
    if (msToDhakaMidnight < 120_000 || dhakaMsIntoDay < 60_000) {
      test.skip(true, 'Skipping streak test near Bangladesh midnight to avoid date boundary flake')
    }
    // getEngagementSummary counts in the UTC day whatever the server TZ (#155): a day behind 00:00-06:00 Bangladesh.
    test.fail(days.now.getUTCHours() >= 18, 'https://github.com/adibahsan/cycle-circle/issues/155')

    const { page, phone } = await newUser()
    const profile = await ensureUserProfile(phone, {
      name: 'Streaker User',
      goal: 'track',
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: days.dateOf(days.daysAgo(10)),
    })

    await setPeriodLogs(profile.id, [
      {
        startDate: days.dateOf(days.daysAgo(10)),
        endDate: days.dateOf(days.daysAgo(6)),
        flowIntensity: 'MEDIUM',
      },
    ])

    // Seed logs for 2 consecutive days before today: daysAgo(2) and daysAgo(1)
    await setSymptomLogs(profile.id, [
      { date: days.dateOf(days.daysAgo(2)), category: 'MOOD', symptomId: 'calm' },
      { date: days.dateOf(days.daysAgo(1)), category: 'MOOD', symptomId: 'happy' },
    ])

    await page.goto('/dashboard')

    // Streak is alive from yesterday, today not yet logged -> streak is 2, at risk
    await expect(page.getByText('2-day symptom streak')).toBeVisible()
    await expect(page.getByText('Your streak is at risk — a quick check-in keeps it alive')).toBeVisible()

    // The check-in modal auto-prompts on page load
    const allGoodBtn = page.getByRole('button', { name: /all good/i })
    await expect(allGoodBtn).toBeVisible({ timeout: 15_000 })
    await allGoodBtn.click()

    // Modal closes, page updates: streak increments to 3, streakAtRisk is cleared
    await expect(page.getByText('3-day symptom streak')).toBeVisible()
    await expect(page.getByText('Your streak is at risk')).toBeHidden()
    await expect(page.getByText("You've checked in today")).toBeVisible()
  })
})

test.describe('Phase pattern card', () => {
  test('shows most-logged symptoms in current phase and empty state when none exist', async ({ newUser, days }) => {
    const { page, phone } = await newUser()
    const profile = await ensureUserProfile(phone, {
      name: 'Phase Pattern User',
      goal: 'track',
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: days.dateOf(days.daysAgo(10)),
    })

    // Cycle 1: started 38 days ago, ended 34 days ago
    // Cycle 2: started 10 days ago (current cycle day 11 = ovulation phase, days 10-15)
    await setPeriodLogs(profile.id, [
      {
        startDate: days.dateOf(days.daysAgo(38)),
        endDate: days.dateOf(days.daysAgo(34)),
        flowIntensity: 'MEDIUM',
      },
      {
        startDate: days.dateOf(days.daysAgo(10)),
        endDate: days.dateOf(days.daysAgo(6)),
        flowIntensity: 'MEDIUM',
      },
    ])

    // In past cycle's ovulation phase (cycle days 10-15 = days -29 to -24), log headache twice and cramps once
    await setSymptomLogs(profile.id, [
      { date: days.dateOf(days.daysAgo(29)), category: 'PHYSICAL', symptomId: 'headache' },
      { date: days.dateOf(days.daysAgo(28)), category: 'PHYSICAL', symptomId: 'headache' },
      { date: days.dateOf(days.daysAgo(27)), category: 'PHYSICAL', symptomId: 'cramps' },
      // Log another symptom in past follicular phase to verify it does not leak into ovulation pattern
      { date: days.dateOf(days.daysAgo(33)), category: 'PHYSICAL', symptomId: 'bloating' },
    ])

    await page.goto('/dashboard')

    const card = page.getByRole('region', { name: 'Your phase pattern' })
    await expect(card).toBeVisible()
    await expect(card.getByRole('heading', { name: 'Your phase pattern' })).toBeVisible()

    // Assert exactly 2 items: Headache (x2) then Cramps (x1) (#123 Finding 4)
    const list = card.getByRole('list')
    await expect(list).toBeVisible()
    const items = list.locator('li')
    await expect(items).toHaveCount(2)
    await expect(items.nth(0)).toContainText('Headache')
    await expect(items.nth(0)).toContainText(/Logged 2 times/i)
    await expect(items.nth(1)).toContainText('Cramps')
    await expect(items.nth(1)).toContainText(/Logged 1 time/i)

    // Negative: other-phase symptom (Bloating from follicular phase) is absent (#123 Finding 4)
    await expect(card).not.toContainText('Bloating')
  })

  test('shows empty state when no symptoms exist for current phase', async ({ newUser, days }) => {
    const { page, phone } = await newUser()
    const profile = await ensureUserProfile(phone, {
      name: 'Empty Phase Pattern User',
      goal: 'track',
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: days.dateOf(days.daysAgo(10)),
    })

    // Cycle 1: started 38 days ago, ended 34 days ago
    // Cycle 2: started 10 days ago (current cycle day 11 = ovulation phase)
    await setPeriodLogs(profile.id, [
      {
        startDate: days.dateOf(days.daysAgo(38)),
        endDate: days.dateOf(days.daysAgo(34)),
        flowIntensity: 'MEDIUM',
      },
      {
        startDate: days.dateOf(days.daysAgo(10)),
        endDate: days.dateOf(days.daysAgo(6)),
        flowIntensity: 'MEDIUM',
      },
    ])
    // No symptoms logged for ovulation phase (#123 Finding 4 empty-state case)

    await page.goto('/dashboard')

    const card = page.getByRole('region', { name: 'Your phase pattern' })
    await expect(card).toBeVisible()
    await expect(card.getByRole('heading', { name: 'Your phase pattern' })).toBeVisible()

    // The empty-state box has no role or accessible name; scope by the card region and its text/link.
    await expect(card.getByText('Log your symptoms this cycle to see your pattern next time.')).toBeVisible()
    await expect(card.getByRole('link', { name: 'Log symptoms' })).toBeVisible()
    await expect(card.getByRole('list')).toHaveCount(0)
  })
})

test.describe('Server render', () => {
  test('dashboard and calendar hydrate without a React mismatch', async ({ newUser, days }) => {
    const { page, phone } = await newUser()
    const profile = await ensureUserProfile(phone, {
      name: 'Hydration User',
      goal: 'track',
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: days.dateOf(days.daysAgo(10)),
    })
    await setPeriodLogs(profile.id, [
      { startDate: days.dateOf(days.daysAgo(10)), endDate: days.dateOf(days.daysAgo(6)), flowIntensity: 'MEDIUM' },
    ])
    await suppressAutoPrompts(page)
    const reactErrors: string[] = []
    page.on('pageerror', (e) => {
      if (/Minified React error #(418|423|425)|hydrat/i.test(e.message)) reactErrors.push(e.message)
    })
    for (const path of ['/dashboard', '/calendar']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      await page.waitForLoadState('networkidle')
    }
    expect(reactErrors).toEqual([])
  })
})
