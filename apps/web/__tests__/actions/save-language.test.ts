import { describe, it, expect, vi, beforeEach } from 'vitest'

// #254: a logged-in User's language switch is saved for background sends;
// a logged-out switch (marketing, login pages) only sets the cookie.
const verifyAuth = vi.fn()
const setUserLanguage = vi.fn()
vi.mock('@vesta/shared/server/auth', () => ({
  verifyAuth: () => verifyAuth(),
  requireAuth: vi.fn(),
  getAuthUser: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@vesta/shared/server/services', () => ({
  setUserLanguage: (...a: unknown[]) => setUserLanguage(...a),
}))

import { saveLanguage } from '../../src/app/actions/user-actions'

beforeEach(() => {
  verifyAuth.mockReset()
  setUserLanguage.mockReset().mockResolvedValue(undefined)
})

describe('saveLanguage', () => {
  it('saves bn for a logged-in User', async () => {
    verifyAuth.mockResolvedValue({ sub: 'user-1' })
    await saveLanguage('bn')
    expect(setUserLanguage).toHaveBeenCalledWith('user-1', 'bn')
  })

  it('does nothing when logged out', async () => {
    verifyAuth.mockResolvedValue(null)
    await saveLanguage('bn')
    expect(setUserLanguage).not.toHaveBeenCalled()
  })

  it('ignores a value that is not en or bn', async () => {
    verifyAuth.mockResolvedValue({ sub: 'user-1' })
    await saveLanguage('fr' as never)
    expect(setUserLanguage).not.toHaveBeenCalled()
  })
})
