import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MOCK_JWT, MOCK_AUTH_USER } from '../helpers/mock-auth'
import { ApiError } from '@vesta/shared/server/api-error'

// --- mocks ---
vi.mock('@vesta/shared/server/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue(MOCK_JWT),
  getAuthUser: vi.fn().mockResolvedValue(MOCK_AUTH_USER),
  // passthrough — the inputs below are already in canonical +880 form
  validateMsisdn: vi.fn((p: string) => p),
}))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@vesta/shared/server/services', () => ({
  completeUserProfile: vi.fn(),
  updateUserContact: vi.fn(),
}))

import { completeProfile, updateContactInfo } from '../../src/app/actions/user-actions'
import * as svc from '@vesta/shared/server/services'
import { validateMsisdn } from '@vesta/shared/server/auth'
import { revalidateTag } from 'next/cache'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('completeProfile', () => {
  it('saves fullName + normalized phone and returns { ok: true }', async () => {
    vi.mocked(svc.completeUserProfile).mockResolvedValue({
      id: 'user-1',
      fullName: 'Jane Doe',
      profileCompleted: true,
    } as never)

    const result = await completeProfile({ fullName: 'Jane Doe', phone: '+8801700000001' })

    expect(svc.completeUserProfile).toHaveBeenCalledWith('user-1', {
      fullName: 'Jane Doe',
      phone: '+8801700000001',
    })
    expect(result).toEqual({ ok: true })
    expect(revalidateTag).toHaveBeenCalledWith('user:user-1', { expire: 0 })
  })

  it('returns { ok: false, code: ERROR } on empty name (no write)', async () => {
    const result = await completeProfile({ fullName: '', phone: '+8801700000001' })
    expect(result).toEqual({ ok: false, code: 'ERROR' })
    expect(svc.completeUserProfile).not.toHaveBeenCalled()
  })

  it('returns { ok: false, code: PHONE_TAKEN } when the phone belongs to another account', async () => {
    vi.mocked(svc.completeUserProfile).mockRejectedValue(
      new ApiError(409, 'Phone already registered to another account', 'PHONE_TAKEN'),
    )

    const result = await completeProfile({ fullName: 'Jane Doe', phone: '+8801700000001' })

    expect(result).toEqual({ ok: false, code: 'PHONE_TAKEN' })
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})

describe('updateContactInfo', () => {
  it('normalizes email (lowercase/trim) before saving and returns { ok: true }', async () => {
    vi.mocked(svc.updateUserContact).mockResolvedValue({} as never)

    const result = await updateContactInfo({ email: '  USER@Example.COM ' })

    expect(svc.updateUserContact).toHaveBeenCalledWith('user-1', { email: 'user@example.com' })
    expect(result).toEqual({ ok: true })
    expect(revalidateTag).toHaveBeenCalledWith('user:user-1', { expire: 0 })
  })

  it('returns { ok: false, code: PHONE_TAKEN } when the number is already in use', async () => {
    vi.mocked(svc.updateUserContact).mockRejectedValue(
      new ApiError(409, 'Phone already registered to another account', 'PHONE_TAKEN'),
    )

    const result = await updateContactInfo({ phone: '+8801700000001' })

    expect(result).toEqual({ ok: false, code: 'PHONE_TAKEN' })
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('returns { ok: false, code: EMAIL_TAKEN } when the email is already in use', async () => {
    vi.mocked(svc.updateUserContact).mockRejectedValue(
      new ApiError(409, 'Email already registered to another account', 'EMAIL_TAKEN'),
    )

    const result = await updateContactInfo({ email: 'taken@example.com' })

    expect(result).toEqual({ ok: false, code: 'EMAIL_TAKEN' })
  })

  it('returns { ok: false, code: INVALID_PHONE } when the number is malformed', async () => {
    vi.mocked(validateMsisdn).mockImplementationOnce(() => {
      throw new ApiError(400, 'Invalid Bangladeshi phone number', 'INVALID_PHONE')
    })

    const result = await updateContactInfo({ phone: '123' })

    expect(result).toEqual({ ok: false, code: 'INVALID_PHONE' })
    expect(svc.updateUserContact).not.toHaveBeenCalled()
  })
})
