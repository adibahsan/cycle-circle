import { describe, it, expect } from 'vitest'
import { decideAdminAccess } from '@vesta/shared/utils/admin-access'

describe('decideAdminAccess', () => {
  it('redirects to login when there is no token', () => {
    expect(decideAdminAccess({ hasToken: false })).toBe('redirect-login')
  })

  it('redirects to login when the token is invalid or expired', () => {
    expect(decideAdminAccess({ hasToken: true, payload: null })).toBe('redirect-login')
  })

  it('returns 403 for a valid non-admin token', () => {
    expect(decideAdminAccess({ hasToken: true, payload: { role: 'USER' } })).toBe('forbidden')
    expect(decideAdminAccess({ hasToken: true, payload: {} })).toBe('forbidden')
  })

  it('passes an admin token', () => {
    expect(decideAdminAccess({ hasToken: true, payload: { role: 'ADMIN' } })).toBe('allow')
  })
})
