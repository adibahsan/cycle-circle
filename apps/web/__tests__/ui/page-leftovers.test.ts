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
    const end = src.indexOf('</PageContainer>', add)
    expect(start).toBeGreaterThan(-1)
    expect(add).toBeGreaterThan(start)
    expect(add).toBeLessThan(end)
  })

  it('last-period date bounds come from the Bangladesh today the page passes in', () => {
    expect(src).not.toContain('toISOString().slice(0, 10)')
    expect(src).not.toContain('deviceDayString')
    expect(src).toContain('lastPeriodDateBounds(today)')
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

describe('no sub-11px text anywhere in the web app', () => {
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) return e.name === 'internal' ? [] : walk(full)
      return /\.(tsx?|css)$/.test(e.name) ? [full] : []
    })
  it('bans text-[9px] and text-[10px] outside app/internal', () => {
    const offenders = walk(SRC).filter((f) => /text-\[(9|10)px\]/.test(fs.readFileSync(f, 'utf8')))
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([])
  })
})

describe('toasts live on the shared toast layer', () => {
  for (const f of ['app/(main)/profiles/ProfilesClient.tsx', 'app/(main)/settings/SettingsClient.tsx']) {
    it(`${f} uses the shared useToast and no local fixed toast`, () => {
      const src = read(f)
      expect(src).toContain("from '@/components/ui/Toast'")
      expect(src).not.toMatch(/fixed[^"'`]*z-(50|\[60\])/)
      expect(src).not.toMatch(/function useToast/)
    })
  }
})

describe('PeriodLogModal resets by remounting, not by a suppressed effect', () => {
  it('has no exhaustive-deps override and keys the body on the open session', () => {
    const src = read('components/PeriodLogModal.tsx')
    expect(src).not.toContain('exhaustive-deps')
    expect(src).toMatch(/<PeriodLogModalBody key=\{session\}/)
  })
})
