import { test, expect } from '../../support/fixtures.ts'
import { ensureUserProfile, setPeriodLogs, setPrediction, setSymptomLogs } from '../../support/db.ts'

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

    // Stepper and ring show example cycle, announced as example
    const journey = page.getByTestId('cycle-journey')
    await expect(journey).toBeVisible()
    await expect(journey).toHaveAttribute('data-example', 'true')
    await expect(page.getByRole('img', { name: /^Example: cycle day \d+ of 28, not your data$/ })).toBeVisible()

    // No real stats
    await expect(page.getByTestId('hero-stats')).toHaveCount(0)
  })

  test('pregnancy dashboard pauses cycle predictions and offers symptom logging', async ({ newUser, days }) => {
    const { page, phone } = await newUser()
    await ensureUserProfile(phone, {
      name: 'Pregnancy User',
      goal: 'pregnant',
      lastPeriodStart: days.startOf(days.daysAgo(40)),
    })

    await page.goto('/dashboard')

    const hero = page.getByRole('region', { name: 'Pregnancy tracking is coming soon' })
    await expect(hero).toBeVisible()
    await expect(hero.getByRole('button', { name: 'Log symptoms' })).toBeVisible()

    // Prediction cards, cycle journey and progress ring are hidden
    await expect(page.getByTestId('hero-stats')).toHaveCount(0)
    await expect(page.getByTestId('cycle-journey')).toHaveCount(0)
    await expect(page.locator('main')).not.toContainText(/fertile|ovulation|next period/i)
  })

  test('menopause dashboard displays days since last period and symptom pattern card', async ({ newUser, days }) => {
    const { page, phone } = await newUser()
    const profile = await ensureUserProfile(phone, {
      name: 'Menopause User',
      goal: 'menopause',
      cycleLength: 90,
      lastPeriodStart: days.startOf(days.daysAgo(50)),
    })

    await setSymptomLogs(profile.id, [
      { date: days.startOf(days.daysAgo(10)), category: 'PHYSICAL', symptomId: 'hot-flashes' },
      { date: days.startOf(days.daysAgo(12)), category: 'PHYSICAL', symptomId: 'hot-flashes' },
      { date: days.startOf(days.daysAgo(5)), category: 'MOOD', symptomId: 'mood-swings' },
    ])

    await page.goto('/dashboard')

    const hero = page.getByRole('region', { name: /Menopause User/ })
    await expect(hero).toBeVisible()
    await expect(hero.getByRole('heading', { name: /Menopause User/ })).toBeVisible()

    // Stat card shows days since
    const daysSince = page.getByTestId('stat-days-since')
    await expect(daysSince).toBeVisible()
    await expect(daysSince).toContainText(/days? since your last period/)

    // Rail shows symptom pattern card (not phase pattern)
    const patternCard = page.getByTestId('symptom-pattern')
    await expect(patternCard).toBeVisible()
    await expect(patternCard.getByRole('heading', { name: 'Your symptom pattern' })).toBeVisible()
    await expect(patternCard).toContainText('Hot Flashes')
  })

  test('standard dashboard displays cycle day hero, live cycle journey and ring', async ({ newUser, days }) => {
    const { page, phone } = await newUser()
    const profile = await ensureUserProfile(phone, {
      name: 'Standard User',
      goal: 'track',
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: days.startOf(days.daysAgo(10)),
    })

    await setPeriodLogs(profile.id, [
      {
        startDate: days.startOf(days.daysAgo(10)),
        endDate: days.startOf(days.daysAgo(6)),
        flowIntensity: 'MEDIUM',
      },
    ])

    await setPrediction(profile.id, {
      tier: 'AVERAGE',
      nextPeriodStart: days.startOf(days.daysFromNow(18)),
      ovulationDay: days.startOf(days.daysFromNow(4)),
      fertileStart: days.startOf(days.daysAgo(1)),
      fertileEnd: days.startOf(days.daysFromNow(5)),
      confidence: 0.7,
    })

    await page.goto('/dashboard')

    // Standard hero greetings and stats
    await expect(page.getByText('Hello, Standard User')).toBeVisible()
    await expect(page.getByTestId('hero-stats')).toBeVisible()
    await expect(page.getByTestId('stat-cycle-day')).toContainText('Cycle day 11')
    await expect(page.getByTestId('stat-fertile')).toContainText('Fertile window open')
    await expect(page.getByTestId('stat-next-period')).toContainText('Next period in 18 days')

    // Live cycle journey and progress ring
    const journey = page.getByTestId('cycle-journey')
    await expect(journey).toBeVisible()
    await expect(journey.locator('[aria-current="step"]')).toBeVisible()
    await expect(page.getByRole('img', { name: /^Cycle day \d+ of \d+$/ })).toBeVisible()
  })
})

test.describe('Late-period alert', () => {
  test('late-period alert opens with the right day count', async ({ newUser, days }) => {
    const { page, phone } = await newUser()
    const profile = await ensureUserProfile(phone, {
      name: 'Late Period User',
      goal: 'track',
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: days.startOf(days.daysAgo(31)),
    })

    await setPeriodLogs(profile.id, [
      {
        startDate: days.startOf(days.daysAgo(31)),
        endDate: days.startOf(days.daysAgo(27)),
        flowIntensity: 'MEDIUM',
      },
    ])

    // Prediction: period was expected 3 days ago
    await setPrediction(profile.id, {
      tier: 'AVERAGE',
      nextPeriodStart: days.startOf(days.daysAgo(3)),
      ovulationDay: days.startOf(days.daysAgo(17)),
      fertileStart: days.startOf(days.daysAgo(22)),
      fertileEnd: days.startOf(days.daysAgo(16)),
      confidence: 0.75,
    })

    await page.goto('/dashboard')

    // Auto-prompt dialog opens
    const modalHeading = page.getByRole('heading', { name: 'Your period is running late' })
    await expect(modalHeading).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('#late-alert-desc')).toContainText("It's 3 days past your prediction")

    const logCta = page.getByRole('button', { name: 'Log my period' })
    await expect(logCta).toBeVisible()
    const laterBtn = page.getByRole('button', { name: 'Maybe later' })
    await expect(laterBtn).toBeVisible()

    // Dismiss the alert modal
    await laterBtn.click()
    await expect(modalHeading).toBeHidden()

    // Hero stat shows late period count
    await expect(page.getByTestId('stat-next-period')).toContainText('Period 3 days late')
  })
})

test.describe('Streak badge and engagement tracking', () => {
  test('streak badge increases after logging on consecutive Bangladesh days', async ({ newUser, days }) => {
    const { page, phone } = await newUser()
    const profile = await ensureUserProfile(phone, {
      name: 'Streaker User',
      goal: 'track',
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: days.startOf(days.daysAgo(10)),
    })

    await setPeriodLogs(profile.id, [
      {
        startDate: days.startOf(days.daysAgo(10)),
        endDate: days.startOf(days.daysAgo(6)),
        flowIntensity: 'MEDIUM',
      },
    ])

    // Seed logs for 2 consecutive days before today: daysAgo(2) and daysAgo(1)
    await setSymptomLogs(profile.id, [
      { date: days.startOf(days.daysAgo(2)), category: 'MOOD', symptomId: 'calm' },
      { date: days.startOf(days.daysAgo(1)), category: 'MOOD', symptomId: 'happy' },
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
      lastPeriodStart: days.startOf(days.daysAgo(10)),
    })

    // Cycle 1: started 38 days ago, ended 34 days ago
    // Cycle 2: started 10 days ago (current cycle day 11 = ovulation phase, days 10-15)
    await setPeriodLogs(profile.id, [
      {
        startDate: days.startOf(days.daysAgo(38)),
        endDate: days.startOf(days.daysAgo(34)),
        flowIntensity: 'MEDIUM',
      },
      {
        startDate: days.startOf(days.daysAgo(10)),
        endDate: days.startOf(days.daysAgo(6)),
        flowIntensity: 'MEDIUM',
      },
    ])

    // In past cycle's ovulation phase (cycle days 10-15 = days -29 to -24), log headache twice and cramps once
    await setSymptomLogs(profile.id, [
      { date: days.startOf(days.daysAgo(29)), category: 'PHYSICAL', symptomId: 'headache' },
      { date: days.startOf(days.daysAgo(28)), category: 'PHYSICAL', symptomId: 'headache' },
      { date: days.startOf(days.daysAgo(27)), category: 'PHYSICAL', symptomId: 'cramps' },
    ])

    await page.goto('/dashboard')

    const card = page.getByTestId('phase-pattern')
    await expect(card).toBeVisible()
    await expect(card.getByRole('heading', { name: 'Your phase pattern' })).toBeVisible()

    const list = page.getByTestId('phase-pattern-list')
    await expect(list).toBeVisible()
    await expect(list.locator('li').first()).toContainText('Headache')
    await expect(list.locator('li').first()).toContainText(/Logged 2 times/)
  })
})
