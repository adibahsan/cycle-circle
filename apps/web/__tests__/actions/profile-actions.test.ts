import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MOCK_JWT, MOCK_AUTH_USER } from '../helpers/mock-auth'

// --- mocks ---
vi.mock('@vesta/shared/server/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue(MOCK_JWT),
  getAuthUser: vi.fn().mockResolvedValue(MOCK_AUTH_USER),
}))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
    delete: vi.fn(),
    set: vi.fn(),
  }),
}))
vi.mock('@vesta/shared/server/services', () => ({
  createProfile: vi.fn(),
  renameProfile: vi.fn(),
  removeProfile: vi.fn(),
  updateUserName: vi.fn(),
  completeUserProfile: vi.fn(),
  assertProfileOwnership: vi.fn(),
}))

// Import after mocks are set up
import {
  createProfile,
  renameProfile,
  deleteProfile,
} from '../../src/app/actions/profile-actions'
import * as svc from '@vesta/shared/server/services'
import { revalidateTag } from 'next/cache'
import { ApiError } from '@vesta/shared/server/api-error'

const MOCK_PROFILE = {
  id: 'profile-1',
  userId: 'user-1',
  name: 'Alice',
  relation: 'SELF' as const,
  cycleLength: 28,
  periodLength: 5,
  lastPeriodStart: null,
  goal: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createProfile', () => {
  it('creates a profile with correct data and auto-creates notification preference', async () => {
    vi.mocked(svc.createProfile).mockResolvedValue(MOCK_PROFILE as never)
    vi.mocked(svc.completeUserProfile).mockResolvedValue(undefined as never)

    const result = await createProfile({
      name: 'Alice',
      relation: 'SELF',
      cycleLength: 28,
      periodLength: 5,
    })

    expect(svc.createProfile).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        name: 'Alice',
        relation: 'SELF',
        cycleLength: 28,
        periodLength: 5,
      }),
    )
    expect(result).toEqual({ ok: true, profile: MOCK_PROFILE })
    expect(revalidateTag).toHaveBeenCalledWith('profiles:user-1', { expire: 0 })
  })

  // #255: a thrown action error reaches the browser as React error #441 in production,
  // so the limit comes back as a typed result the page can translate.
  it('returns PROFILE_LIMIT_REACHED instead of throwing when the user already has 6 profiles', async () => {
    vi.mocked(svc.createProfile).mockRejectedValue(
      new ApiError(409, 'You can have up to 6 profiles. Delete one to add another.', 'PROFILE_LIMIT_REACHED'),
    )

    await expect(createProfile({ name: 'Alice', relation: 'SELF' })).resolves.toEqual({ ok: false, code: 'PROFILE_LIMIT_REACHED' })
    expect(svc.completeUserProfile).not.toHaveBeenCalled()
  })

  it('still throws unexpected errors', async () => {
    vi.mocked(svc.createProfile).mockRejectedValue(new Error('db down'))
    await expect(createProfile({ name: 'Alice', relation: 'SELF' })).rejects.toThrow('db down')
  })

  it('seeds period log when lastPeriodStart is provided', async () => {
    const profileWithDate = { ...MOCK_PROFILE, lastPeriodStart: new Date('2026-01-15') }
    vi.mocked(svc.createProfile).mockResolvedValue(profileWithDate as never)
    vi.mocked(svc.completeUserProfile).mockResolvedValue(undefined as never)

    const result = await createProfile({
      name: 'Alice',
      relation: 'SELF',
      lastPeriodStart: '2026-01-15',
    })

    expect(svc.createProfile).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ lastPeriodStart: '2026-01-15' }),
    )
    expect(result).toEqual({ ok: true, profile: profileWithDate })
  })
})

describe('renameProfile', () => {
  it('updates name and revalidates path', async () => {
    const updatedProfile = { ...MOCK_PROFILE, name: 'Alicia' }
    vi.mocked(svc.renameProfile).mockResolvedValue(updatedProfile as never)

    const result = await renameProfile('profile-1', 'Alicia')

    expect(svc.renameProfile).toHaveBeenCalledWith('profile-1', 'user-1', 'Alicia')
    expect(result).toEqual(updatedProfile)
    expect(revalidateTag).toHaveBeenCalledWith('profiles:user-1', { expire: 0 })
  })

  it('throws when profile belongs to a different user', async () => {
    vi.mocked(svc.renameProfile).mockRejectedValue(new Error('Profile not found'))

    await expect(renameProfile('profile-1', 'Alicia')).rejects.toThrow('Profile not found')
  })
})

describe('deleteProfile', () => {
  it('deletes profile and revalidates path', async () => {
    vi.mocked(svc.removeProfile).mockResolvedValue(MOCK_PROFILE as never)

    await deleteProfile('profile-1')

    expect(svc.removeProfile).toHaveBeenCalledWith('profile-1', 'user-1')
    expect(revalidateTag).toHaveBeenCalledWith('profiles:user-1', { expire: 0 })
    expect(revalidateTag).toHaveBeenCalledWith('tracking:profile-1', { expire: 0 })
  })

  it('throws when trying to delete the last profile', async () => {
    vi.mocked(svc.removeProfile).mockRejectedValue(new Error('Cannot delete your last profile'))

    await expect(deleteProfile('profile-1')).rejects.toThrow('Cannot delete your last profile')
  })

  it('throws when profile is not owned by the current user', async () => {
    vi.mocked(svc.removeProfile).mockRejectedValue(new Error('Profile not found'))

    await expect(deleteProfile('profile-1')).rejects.toThrow('Profile not found')
  })
})
