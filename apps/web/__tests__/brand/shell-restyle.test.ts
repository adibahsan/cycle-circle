import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
vi.mock('@/app/actions/tracking-actions', () => ({ createPeriodLog: vi.fn(), updatePeriodLog: vi.fn() }))

import { FLOW_COLORS, FLOW_TEXT } from '@/components/PeriodLogModal'

const src = path.resolve(__dirname, '../../src')

function walk(p: string): string[] {
  if (statSync(p).isFile()) return [p]
  return readdirSync(p).flatMap((f) => walk(path.join(p, f)))
}

const owned = [
  'components/shell/MainShell.tsx',
  'app/(main)/dashboard',
  'app/(main)/calendar',
  'components/PeriodLogModal.tsx',
  'components/nudge',
  'components/engagement/TodayCheckInStrip.tsx',
  'components/engagement/ConsistencyGrid.tsx',
  'components/engagement/ProgressToUnlockMeter.tsx',
].flatMap((p) => walk(path.join(src, p)))

const LEGACY = /#(E8476C|F2728E|C93558|9B7FD4|B9A4E3|FF8C6B|7BC5AE)([0-9A-F]{2})?\b/i

describe('flow intensity tokens', () => {
  it('FLOW_COLORS', () => {
    expect(FLOW_COLORS).toEqual({
      light: 'var(--color-follicular)',
      medium: 'var(--color-primary)',
      heavy: 'var(--color-menstrual)',
    })
  })
  it('FLOW_TEXT', () => {
    expect(FLOW_TEXT).toEqual({
      light: 'var(--color-on-follicular)',
      medium: 'var(--color-on-accent)',
      heavy: 'var(--color-on-menstrual)',
    })
  })
})

describe('owned shell/dashboard/calendar files', () => {
  it.each(owned.map((f) => [path.relative(src, f), f]))('%s has no legacy hex, text-white or Vesta wordmark', (_n, f) => {
    const s = readFileSync(f, 'utf8')
    expect(s).not.toMatch(LEGACY)
    expect(s).not.toMatch(/\btext-white\b/)
    expect(s).not.toMatch(/>\s*Vesta\s*</)
  })
})
