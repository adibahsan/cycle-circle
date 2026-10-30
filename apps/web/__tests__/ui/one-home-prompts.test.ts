import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { checkInCandidateState, daysSinceLastLog, loggingNudgeVariant, showCompletionRow } from '@/lib/prompt-rules'

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
  const today = '2026-10-08'
  const stored = (day: string) => new Date(`${day}T00:00:00.000Z`)
  it('is null with no logs', () => {
    expect(daysSinceLastLog([], today)).toBeNull()
  })
  it('counts whole Bangladesh days from the most recent stored log', () => {
    expect(daysSinceLastLog([stored('2026-10-01'), stored('2026-10-05')], today)).toBe(3)
    expect(daysSinceLastLog([stored('2026-10-08')], today)).toBe(0)
  })
  it('reads a stored date by its UTC day, so the answer does not depend on the process timezone', () => {
    // 2026-10-05T00:00Z is still Oct 4 on a phone west of UTC; the stored day is Oct 5.
    expect(daysSinceLastLog([stored('2026-10-05')], '2026-10-06')).toBe(1)
  })
})

describe('checkInCandidateState', () => {
  it('is pending until the engagement data arrives', () => {
    expect(checkInCandidateState(undefined)).toBe('pending')
  })
  it('is no once the load settled without data', () => {
    expect(checkInCandidateState(null)).toBe('no')
  })
  it('is no when something was already logged today, yes otherwise', () => {
    expect(checkInCandidateState({ loggedToday: true })).toBe('no')
    expect(checkInCandidateState({ loggedToday: false })).toBe('yes')
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
  it('treats never-logged as more than 3 days without a log (nudge, never silence)', () => {
    const neverLogged = loggingNudgeVariant({ hasAnyLogs: false, daysSinceLastLog: null })
    expect(neverLogged).not.toBeNull()
    expect(neverLogged).toBe('empty')
    // even a bogus recent value cannot suppress it
    expect(loggingNudgeVariant({ hasAnyLogs: false, daysSinceLastLog: 0 })).toBe('empty')
  })
  it('shows the empty variant when nothing was ever logged', () => {
    expect(loggingNudgeVariant({ hasAnyLogs: false, daysSinceLastLog: null })).toBe('empty')
  })
})

describe('one home per prompt (source scan)', () => {
  it('the main layout no longer renders the completion banner', () => {
    const layout = src('components/shell/MainShell.tsx')
    expect(layout).not.toMatch(/<ProfileCompletionTracker/)
    expect(layout).not.toMatch(/variant="pill"/)
    expect(layout).toContain('<ProfileChip')
  })
  it('the unused ProfileCompletionTracker component is gone', () => {
    expect(existsSync(resolve(__dirname, '../../src/components/ProfileCompletionTracker.tsx'))).toBe(false)
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
