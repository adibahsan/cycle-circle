import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MOCK_JWT, MOCK_AUTH_USER } from '../helpers/mock-auth'

// --- mocks ---
vi.mock('@vesta/shared/server/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue(MOCK_JWT),
  getAuthUser: vi.fn().mockResolvedValue(MOCK_AUTH_USER),
}))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@vesta/shared/server/services', () => ({
  completeUserProfile: vi.fn(),
}))

import * as actions from '../../src/app/actions/user-actions'
import * as svc from '@vesta/shared/server/services'
import { revalidateTag } from 'next/cache'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('completeProfile', () => {
  it('saves fullName only and returns { ok: true }', async () => {
    vi.mocked(svc.completeUserProfile).mockResolvedValue({
      id: 'user-1',
      fullName: 'Jane Doe',
      profileCompleted: true,
    } as never)

    // A caller passing a phone anyway must not get it saved: it never reaches the service.
    const result = await actions.completeProfile({ fullName: 'Jane Doe', phone: '+8801700000001' } as never)

    expect(svc.completeUserProfile).toHaveBeenCalledWith('user-1', { fullName: 'Jane Doe' })
    expect(result).toEqual({ ok: true })
    expect(revalidateTag).toHaveBeenCalledWith('user:user-1', { expire: 0 })
  })

  it('returns { ok: false, code: ERROR } on empty name (no write)', async () => {
    const result = await actions.completeProfile({ fullName: '' })
    expect(result).toEqual({ ok: false, code: 'ERROR' })
    expect(svc.completeUserProfile).not.toHaveBeenCalled()
  })

  it('returns { ok: false, code: ERROR } when the write fails', async () => {
    vi.mocked(svc.completeUserProfile).mockRejectedValue(new Error('db down'))
    expect(await actions.completeProfile({ fullName: 'Jane Doe' })).toEqual({ ok: false, code: 'ERROR' })
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})

describe('unverified contact writes are gone', () => {
  it('no action saves a phone or email without verification', () => {
    expect('updateContactInfo' in actions).toBe(false)
  })
})
