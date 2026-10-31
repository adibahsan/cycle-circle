import { describe, expect, it } from 'vitest'
import { describeLastCheck } from '../subscription-check-strip'

const NOW = new Date('2026-06-10T12:00:00Z')
const run = (over: Partial<Parameters<typeof describeLastCheck>[0] & object> = {}) => ({
  startedAt: new Date('2026-06-10T03:00:00Z'),
  status: 'OK' as const,
  error: null,
  ...over,
})

describe('describeLastCheck', () => {
  it('warns when the check has never run', () => {
    expect(describeLastCheck(null, NOW)).toMatchObject({ state: 'never', warning: expect.stringMatching(/never run/i) })
  })

  it('has no warning for a recent ok run', () => {
    expect(describeLastCheck(run(), NOW)).toEqual({ state: 'ok', warning: null })
  })

  it('warns when the last run is older than a day', () => {
    const r = describeLastCheck(run({ startedAt: new Date('2026-06-09T11:59:00Z') }), NOW)
    expect(r.state).toBe('ok')
    expect(r.warning).toMatch(/more than a day/i)
  })

  it('does not warn at exactly one day', () => {
    expect(describeLastCheck(run({ startedAt: new Date('2026-06-09T12:00:00Z') }), NOW).warning).toBeNull()
  })

  it('warns when the last run failed', () => {
    const r = describeLastCheck(run({ status: 'FAILED', error: 'boom' }), NOW)
    expect(r.state).toBe('failed')
    expect(r.warning).toMatch(/failed/i)
  })

  it('says a skipped run did not check anyone', () => {
    const r = describeLastCheck(run({ status: 'SKIPPED' }), NOW)
    expect(r.state).toBe('skipped')
    expect(r.warning).toMatch(/switched off/i)
  })
})
