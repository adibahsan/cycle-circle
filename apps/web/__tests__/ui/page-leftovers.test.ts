import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '../../src')
const read = (p: string) => fs.readFileSync(path.join(SRC, p), 'utf8')

describe('profiles page', () => {
  const src = read('app/(main)/profiles/ProfilesClient.tsx')

  it('the add-profile control sits in the same grid as the profile cards', () => {
    const start = src.indexOf('lg:grid lg:grid-cols-2')
    const add = src.indexOf('<AddProfileForm')
    const end = src.indexOf('Switch confirmation toast')
    expect(start).toBeGreaterThan(-1)
    expect(add).toBeGreaterThan(start)
    expect(add).toBeLessThan(end)
  })

  it('last-period date bounds use the local day, not the UTC day', () => {
    expect(src).not.toContain('toISOString().slice(0, 10)')
    expect(src).toContain('localDayString')
  })
})

describe('primary surfaces have no 10px text', () => {
  const FILES = [
    'app/(main)/profiles/ProfilesClient.tsx',
    'app/(main)/subscription/SubscriptionClient.tsx',
    'app/(main)/feedback/FeedbackClient.tsx',
    'app/(main)/insights/InsightsClient.tsx',
    'app/onboarding/OnboardingClient.tsx',
    'app/(main)/content/ContentClient.tsx',
    'app/(main)/calendar/CalendarClient.tsx',
    'app/(main)/symptoms/SymptomsClient.tsx',
    'components/engagement/ConsistencyGrid.tsx',
    'components/engagement/TodayCheckInModal.tsx',
    'app/(main)/dashboard/DashboardClient.tsx',
    'components/engagement/StreakBadge.tsx',
  ]
  for (const f of FILES)
    it(`${f} has no text-[10px]`, () => {
      expect(read(f)).not.toMatch(/text-\[10px\]/)
    })
})

describe('onboarding header at 375px', () => {
  it('the identity text collapses on phones so brand, controls and counter fit', () => {
    const src = read('components/onboarding/AccountControl.tsx')
    expect(src).toMatch(/sr-only sm:not-sr-only/)
  })
})
