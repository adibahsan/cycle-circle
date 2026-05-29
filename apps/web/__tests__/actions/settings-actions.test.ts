import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockPrismaClient } from '../helpers/mock-prisma'
import { MOCK_JWT, MOCK_AUTH_USER } from '../helpers/mock-auth'

// --- mocks ---
vi.mock('@vesta/shared', () => ({ prisma: mockPrismaClient }))
vi.mock('@vesta/shared/server/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue(MOCK_JWT),
  getAuthUser: vi.fn().mockResolvedValue(MOCK_AUTH_USER),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { updateNotificationPrefs } from '../../src/app/actions/settings-actions'
import { revalidatePath } from 'next/cache'

const MOCK_PROFILE = {
  id: 'profile-1',
  userId: 'user-1',
  name: 'Alice',
}

const MOCK_NOTIF_PREF = {
  id: 'notif-1',
  profileId: 'profile-1',
  periodAlert: false,
  fertileWindow: true,
  loggingReminder: false,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('updateNotificationPrefs', () => {
  it('upserts notification preferences for the profile', async () => {
    mockPrismaClient.profile.findUnique.mockResolvedValue(MOCK_PROFILE)
    mockPrismaClient.notificationPreference.upsert.mockResolvedValue(MOCK_NOTIF_PREF)

    const result = await updateNotificationPrefs({
      profileId: 'profile-1',
      periodAlert: false,
      loggingReminder: false,
    })

    expect(mockPrismaClient.notificationPreference.upsert).toHaveBeenCalledWith({
      where: { profileId: 'profile-1' },
      create: {
        profileId: 'profile-1',
        periodAlert: false,
        fertileWindow: true,
        loggingReminder: false,
      },
      update: {
        periodAlert: false,
        loggingReminder: false,
      },
    })
    expect(result).toEqual(MOCK_NOTIF_PREF)
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('throws when profile is not owned by the current user', async () => {
    mockPrismaClient.profile.findUnique.mockResolvedValue({
      ...MOCK_PROFILE,
      userId: 'other-user-id',
    })

    await expect(
      updateNotificationPrefs({ profileId: 'profile-1', periodAlert: true }),
    ).rejects.toThrow('Profile not found')

    expect(mockPrismaClient.notificationPreference.upsert).not.toHaveBeenCalled()
  })
})
