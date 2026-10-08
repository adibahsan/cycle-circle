import { describe, it, expect } from 'vitest'
import net from 'node:net'
import { applyStatusMock, applyLoggingMock, MOCKS } from '../../e2e/support/mocks'
import { findFreePort } from '../../e2e/support/ports'
import { PERSONAS } from '../../e2e/support/personas'

const NOW = new Date('2026-10-08T12:00:00Z')

describe('mocks', () => {
  it('trial-expired makes an email FREE user whose trial ended yesterday', () => {
    const out = applyStatusMock({ user: { id: 'u' } }, ['trial-expired'], NOW) as { user: Record<string, unknown> }
    expect(out.user.authMethod).toBe('EMAIL')
    expect(out.user.subscriptionStatus).toBe('FREE')
    expect(new Date(out.user.emailTrialExpiresAt as string).getTime()).toBeLessThan(NOW.getTime())
  })
  it('email-trial has a future expiry and no phone', () => {
    const out = applyStatusMock({ user: {} }, ['email-trial'], NOW) as { user: Record<string, unknown> }
    expect(new Date(out.user.emailTrialExpiresAt as string).getTime()).toBeGreaterThan(NOW.getTime())
    expect(out.user.phone).toBeNull()
  })
  it('late-period patches logging status only', () => {
    expect(applyLoggingMock({ a: 1 }, ['late-period'])).toEqual({ a: 1, isPeriodLate: true, daysLate: 4 })
    expect(applyStatusMock({ user: { x: 1 } }, ['late-period'], NOW)).toEqual({ user: { x: 1 } })
  })
  it('combines several mocks and registry names are stable', () => {
    expect(Object.keys(MOCKS).sort()).toEqual(['email-trial', 'free-user', 'late-period', 'trial-expired'])
  })
})

describe('findFreePort', () => {
  it('returns a port nothing is listening on', async () => {
    const port = await findFreePort()
    await new Promise<void>((res, rej) => {
      const s = net.createServer().once('error', rej).listen(port, () => s.close(() => res()))
    })
  })
})

describe('personas', () => {
  it('never use the phone reserved by the backend period-log fixture', () => {
    for (const p of Object.values(PERSONAS)) expect(p.phone).not.toContain('700000099')
    expect(PERSONAS.seed.phone).toBe('01700000001')
    expect(PERSONAS.fresh.phone).toBe('01700000777')
  })
})
