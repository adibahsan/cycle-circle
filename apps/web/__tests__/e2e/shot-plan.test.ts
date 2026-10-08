import { describe, it, expect } from 'vitest'
import { VIEWPORTS, planShots, shotFileName } from '../../e2e/support/shot-plan'
import { parseShotArgs } from '../../e2e/support/args'

describe('viewports', () => {
  it('covers desktop 1366x900 and phones 375x667 and 390x844', () => {
    expect(VIEWPORTS.desktop).toEqual({ width: 1366, height: 900 })
    expect(VIEWPORTS['phone-375']).toEqual({ width: 375, height: 667 })
    expect(VIEWPORTS['phone-390']).toEqual({ width: 390, height: 844 })
  })
})

describe('planShots', () => {
  it('defaults to light+dark across desktop, 375 and 390', () => {
    const plan = planShots({ label: 'dashboard' })
    expect(plan).toHaveLength(6)
    expect(plan.map((p) => p.file)).toContain('dashboard-dark-phone-375.png')
    expect(plan.map((p) => p.file)).toContain('dashboard-light-desktop.png')
  })
  it('honours theme and viewport filters', () => {
    const plan = planShots({ label: 'x', themes: ['dark'], viewports: ['desktop'] })
    expect(plan).toEqual([
      { theme: 'dark', viewport: 'desktop', file: 'x-dark-desktop.png' },
    ])
  })
  it('builds file names', () => {
    expect(shotFileName('a', 'light', 'phone-390')).toBe('a-light-phone-390.png')
  })
})

describe('parseShotArgs', () => {
  it('parses route, popup, mocks, persona, themes, viewports, label', () => {
    const a = parseShotArgs([
      '--route', '/dashboard', '--popup', 'period-log', '--mock', 'trial-expired,late-period',
      '--persona', 'fresh', '--themes', 'dark', '--viewports', 'desktop,phone-375', '--label', 'my',
    ])
    expect(a).toMatchObject({
      route: '/dashboard', popup: 'period-log', mocks: ['trial-expired', 'late-period'],
      persona: 'fresh', themes: ['dark'], viewports: ['desktop', 'phone-375'], label: 'my',
    })
  })
  it('derives a label and defaults persona', () => {
    const a = parseShotArgs(['--route', '/calendar', '--popup', 'calendar-day'])
    expect(a.label).toBe('calendar-calendar-day')
    expect(a.persona).toBe('seed')
  })
  it('requires route and rejects unknown values', () => {
    expect(() => parseShotArgs([])).toThrow(/--route/)
    expect(() => parseShotArgs(['--route', '/a', '--themes', 'sepia'])).toThrow(/theme/)
    expect(() => parseShotArgs(['--route', '/a', '--viewports', 'tv'])).toThrow(/viewport/)
    expect(() => parseShotArgs(['--route', '/a', '--mock', 'nope'])).toThrow(/mock/)
    expect(() => parseShotArgs(['--route', '/a', '--popup', 'nope'])).toThrow(/popup/)
    expect(() => parseShotArgs(['--route', '/a', '--persona', 'bob'])).toThrow(/persona/)
  })
})
