import { describe, it, expect } from 'vitest'
import { decideAutoPrompt, bdDayKey, type Candidates } from '@/lib/auto-prompt'

const H = 3_600_000
const DAY = 24 * H
// 2026-10-08 12:00 UTC = 18:00 in UTC+6
const NOW = Date.UTC(2026, 9, 8, 12, 0, 0)
const OLD_ACCOUNT = NOW - 30 * DAY

const yes = { state: 'yes' as const }
function decide(candidates: Candidates, extra: Partial<Parameters<typeof decideAutoPrompt>[0]> = {}) {
  return decideAutoPrompt({ now: NOW, candidates, lastShown: {}, accountCreatedAt: OLD_ACCOUNT, shown: null, ...extra })
}

describe('priority', () => {
  it('trial lock beats everything', () => {
    expect(decide({ 'trial-lock': yes, 'late-alert': yes, tour: yes, 'check-in': yes, profile: yes })).toEqual({ kind: 'show', id: 'trial-lock' })
  })
  it('late alert > tour > check-in > profile', () => {
    expect(decide({ 'late-alert': yes, tour: yes, 'check-in': yes, profile: yes })).toEqual({ kind: 'show', id: 'late-alert' })
    expect(decide({ tour: yes, 'check-in': yes, profile: yes })).toEqual({ kind: 'show', id: 'tour' })
    expect(decide({ 'check-in': yes, profile: yes })).toEqual({ kind: 'show', id: 'check-in' })
    expect(decide({ profile: yes })).toEqual({ kind: 'show', id: 'profile' })
  })
  it('nothing eligible shows nothing', () => {
    expect(decide({ 'late-alert': { state: 'no' } })).toEqual({ kind: 'none' })
    expect(decide({})).toEqual({ kind: 'none' })
  })
})

describe('one per page load', () => {
  it('once a prompt has been shown, lower ones are deferred', () => {
    expect(decide({ 'check-in': yes, profile: yes }, { shown: 'late-alert' })).toEqual({ kind: 'none' })
  })
  it('the trial lock still overrides an already shown prompt', () => {
    expect(decide({ 'trial-lock': yes }, { shown: 'check-in' })).toEqual({ kind: 'show', id: 'trial-lock' })
  })
})

describe('waiting for unresolved higher-priority candidates', () => {
  it('waits when a higher candidate is still pending', () => {
    expect(decide({ 'late-alert': { state: 'pending' }, 'check-in': yes })).toEqual({ kind: 'wait' })
  })
  it('does not wait on a pending candidate below the winner', () => {
    expect(decide({ 'check-in': yes, profile: { state: 'pending' } })).toEqual({ kind: 'show', id: 'check-in' })
  })
  it('waits when only a pending candidate exists', () => {
    expect(decide({ profile: { state: 'pending' } })).toEqual({ kind: 'wait' })
  })
  it('a pending candidate blocked by cadence does not make us wait', () => {
    expect(decide({ 'late-alert': { state: 'pending' }, 'check-in': yes }, { lastShown: { 'late-alert': NOW - H } })).toEqual({ kind: 'show', id: 'check-in' })
  })
})

describe('daily cadence (late alert, tour, check-in)', () => {
  it.each(['late-alert', 'tour', 'check-in'] as const)('%s: not twice on the same local day', (id) => {
    expect(decide({ [id]: yes }, { lastShown: { [id]: NOW - 2 * H } })).toEqual({ kind: 'none' })
  })
  it.each(['late-alert', 'tour', 'check-in'] as const)('%s: shows again the next local day', (id) => {
    expect(decide({ [id]: yes }, { lastShown: { [id]: NOW - DAY } })).toEqual({ kind: 'show', id })
  })
  it('ignoreCadence bypasses the daily limit', () => {
    expect(decide({ tour: { state: 'yes', ignoreCadence: true } }, { lastShown: { tour: NOW - H } })).toEqual({ kind: 'show', id: 'tour' })
  })
})

describe('local day boundaries at UTC+6', () => {
  it('18:00 UTC is already the next local day', () => {
    expect(bdDayKey(Date.UTC(2026, 9, 8, 17, 59))).toBe('2026-10-08')
    expect(bdDayKey(Date.UTC(2026, 9, 8, 18, 0))).toBe('2026-10-09')
  })
  it('shown 17:59 UTC and now 18:01 UTC are different local days', () => {
    const now = Date.UTC(2026, 9, 8, 18, 1)
    const last = Date.UTC(2026, 9, 8, 17, 59)
    expect(decideAutoPrompt({ now, candidates: { 'check-in': yes }, lastShown: { 'check-in': last }, accountCreatedAt: OLD_ACCOUNT, shown: null })).toEqual({ kind: 'show', id: 'check-in' })
  })
  it('shown 00:30 UTC and now 17:00 UTC are the same local day', () => {
    const now = Date.UTC(2026, 9, 8, 17, 0)
    const last = Date.UTC(2026, 9, 8, 0, 30)
    expect(decideAutoPrompt({ now, candidates: { 'check-in': yes }, lastShown: { 'check-in': last }, accountCreatedAt: OLD_ACCOUNT, shown: null })).toEqual({ kind: 'none' })
  })
})

describe('profile prompt cadence', () => {
  it('not within 3 days of the last showing', () => {
    expect(decide({ profile: yes }, { lastShown: { profile: NOW - 3 * DAY + H } })).toEqual({ kind: 'none' })
  })
  it('again after 3 days', () => {
    expect(decide({ profile: yes }, { lastShown: { profile: NOW - 3 * DAY } })).toEqual({ kind: 'show', id: 'profile' })
  })
  it('never within 24 hours of account creation', () => {
    expect(decide({ profile: yes }, { accountCreatedAt: NOW - 24 * H + 1 })).toEqual({ kind: 'none' })
    expect(decide({ profile: yes }, { accountCreatedAt: NOW - 24 * H })).toEqual({ kind: 'show', id: 'profile' })
  })
  it('unknown account age blocks the profile prompt', () => {
    expect(decide({ profile: yes }, { accountCreatedAt: null })).toEqual({ kind: 'none' })
  })
  it('the first-24h exclusion does not affect other prompts', () => {
    expect(decide({ 'check-in': yes }, { accountCreatedAt: NOW - H })).toEqual({ kind: 'show', id: 'check-in' })
  })
  it('a skipped profile prompt falls through to nothing, not to a later load', () => {
    expect(decide({ profile: yes }, { accountCreatedAt: NOW - H })).toEqual({ kind: 'none' })
  })
})
