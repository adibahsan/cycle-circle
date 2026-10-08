import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { daysSinceLastLog, loggingNudgeVariant, showCompletionRow } from '@/lib/prompt-rules'

const src = (p: string) => readFileSync(resolve(__dirname, '../../src', p), 'utf8')

describe('showCompletionRow', () => {
  it('shows while below 100% and hides at 100%', () => {
    expect(showCompletionRow({ percent: 40, complete: false, items: [] })).toBe(true)
    expect(showCompletionRow({ percent: 100, complete: true, items: [] })).toBe(false)
  })
  it('hides when there is no status', () => {
    expect(showCompletionRow(null)).toBe(false)
  })
})

describe('daysSinceLastLog', () => {
  const today = new Date(2026, 9, 8, 15, 0)
  it('is null with no logs', () => {
    expect(daysSinceLastLog([], today)).toBeNull()
  })
  it('counts whole local days from the most recent log', () => {
    expect(daysSinceLastLog([new Date(2026, 9, 1), new Date(2026, 9, 5, 23, 0)], today)).toBe(3)
    expect(daysSinceLastLog([new Date(2026, 9, 8, 0, 1)], today)).toBe(0)
  })
})

describe('loggingNudgeVariant', () => {
  it('stays quiet under 3 days', () => {
    expect(loggingNudgeVariant({ hasAnyLogs: true, daysSinceLastLog: 2 })).toBeNull()
  })
  it('shows the stale variant from 3 days', () => {
    expect(loggingNudgeVariant({ hasAnyLogs: true, daysSinceLastLog: 3 })).toBe('stale')
    expect(loggingNudgeVariant({ hasAnyLogs: true, daysSinceLastLog: 9 })).toBe('stale')
  })
  it('shows the empty variant when nothing was ever logged', () => {
    expect(loggingNudgeVariant({ hasAnyLogs: false, daysSinceLastLog: null })).toBe('empty')
  })
})

describe('one home per prompt (source scan)', () => {
  it('the main layout no longer renders the completion banner', () => {
    const layout = src('app/(main)/layout.tsx')
    expect(layout).not.toMatch(/<ProfileCompletionTracker/)
    expect(layout).not.toMatch(/variant="pill"/)
    expect(layout).toContain('<ProfileChip')
  })
  it('the tracker has no pill variant left', () => {
    expect(src('components/ProfileCompletionTracker.tsx')).not.toMatch(/'pill'/)
  })
  it('the dashboard renders the compact completion row', () => {
    expect(existsSync(resolve(__dirname, '../../src/components/prompts/CompletionRow.tsx'))).toBe(true)
    expect(src('app/(main)/dashboard/DashboardClient.tsx')).toContain('<CompletionRow')
  })
  it('the logging nudge is not on the calendar', () => {
    expect(src('app/(main)/calendar/CalendarClient.tsx')).not.toMatch(/LoggingNudge/)
  })
  it('the logging nudge never asks for a check-in', () => {
    const nudge = src('components/nudge/LoggingNudge.tsx')
    expect(nudge).not.toMatch(/streakAtRisk|onLogSymptoms/)
    const dash = src('app/(main)/dashboard/DashboardClient.tsx')
    const calls = dash.match(/<LoggingNudge[\s\S]*?\/>/g) ?? []
    expect(calls.length).toBeGreaterThan(0)
    for (const c of calls) expect(c).not.toMatch(/setCheckInOpen/)
  })
})
