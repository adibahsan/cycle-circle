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

import { completeProfile } from '../../src/app/actions/user-actions'
import * as svc from '@vesta/shared/server/services'
import { revalidateTag } from 'next/cache'

const MOCK_UPDATED_USER = {
  id: 'user-1',
  fullName: 'Jane Doe',
  profileCompleted: true,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('completeProfile', () => {
  it('updates user with fullName, phone, and profileCompleted=true', async () => {
    vi.mocked(svc.completeUserProfile).mockResolvedValue(MOCK_UPDATED_USER as never)

    const result = await completeProfile({
      fullName: 'Jane Doe',
      phone: '+8801700000001',
    })

    expect(svc.completeUserProfile).toHaveBeenCalledWith('user-1', {
      fullName: 'Jane Doe',
      phone: '+8801700000001',
    })
    expect(result).toEqual({
      id: 'user-1',
      fullName: 'Jane Doe',
      profileCompleted: true,
    })
    expect(revalidateTag).toHaveBeenCalledWith('user:user-1', { expire: 0 })
  })

  it('throws on empty name', async () => {
    await expect(
      completeProfile({ fullName: '', phone: '+8801700000001' }),
    ).rejects.toThrow()

    expect(svc.completeUserProfile).not.toHaveBeenCalled()
  })
})
