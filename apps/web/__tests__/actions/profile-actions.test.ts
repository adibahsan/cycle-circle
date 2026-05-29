import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockPrismaClient } from '../helpers/mock-prisma'
import { MOCK_JWT, MOCK_AUTH_USER } from '../helpers/mock-auth'

// --- mocks ---
vi.mock('@vesta/shared', () => ({ prisma: mockPrismaClient }))
vi.mock('@vesta/shared/server/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue(MOCK_JWT),
  getAuthUser: vi.fn().mockResolvedValue(MOCK_AUTH_USER),
}))
vi.mock('@vesta/shared/server/period-log-sync', () => ({
  ensurePeriodLogFromProfile: vi.fn().mockResolvedValue(null),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// Import after mocks are set up
import {
  createProfile,
  renameProfile,
  deleteProfile,
} from '../../src/app/actions/profile-actions'
import { ensurePeriodLogFromProfile } from '@vesta/shared/server/period-log-sync'
import { revalidatePath } from 'next/cache'

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

const MOCK_NOTIF_PREF = {
  id: 'notif-1',
  profileId: 'profile-1',
  periodAlert: true,
  fertileWindow: true,
  loggingReminder: true,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createProfile', () => {
  it('creates a profile with correct data and auto-creates notification preference', async () => {
    mockPrismaClient.profile.count.mockResolvedValue(0)
    mockPrismaClient.profile.create.mockResolvedValue(MOCK_PROFILE)
    mockPrismaClient.notificationPreference.create.mockResolvedValue(MOCK_NOTIF_PREF)

    const result = await createProfile({
      name: 'Alice',
      relation: 'SELF',
      cycleLength: 28,
      periodLength: 5,
    })

    expect(mockPrismaClient.profile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        name: 'Alice',
        relation: 'SELF',
        cycleLength: 28,
        periodLength: 5,
      }),
    })
    expect(mockPrismaClient.notificationPreference.create).toHaveBeenCalledWith({
      data: {
        profileId: 'profile-1',
        periodAlert: true,
        fertileWindow: true,
        loggingReminder: true,
      },
    })
    expect(result).toEqual(MOCK_PROFILE)
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('throws when user already has 6 profiles', async () => {
    mockPrismaClient.profile.count.mockResolvedValue(6)

    await expect(
      createProfile({ name: 'Alice', relation: 'SELF' }),
    ).rejects.toThrow('Maximum of 6 profiles allowed')

    expect(mockPrismaClient.profile.create).not.toHaveBeenCalled()
  })

  it('seeds period log when lastPeriodStart is provided', async () => {
    const profileWithDate = { ...MOCK_PROFILE, lastPeriodStart: new Date('2026-01-15') }
    mockPrismaClient.profile.count.mockResolvedValue(0)
    mockPrismaClient.profile.create.mockResolvedValue(profileWithDate)
    mockPrismaClient.notificationPreference.create.mockResolvedValue(MOCK_NOTIF_PREF)

    await createProfile({
      name: 'Alice',
      relation: 'SELF',
      lastPeriodStart: '2026-01-15',
    })

    expect(ensurePeriodLogFromProfile).toHaveBeenCalledWith(profileWithDate)
  })
})

describe('renameProfile', () => {
  it('updates name and revalidates path', async () => {
    const updatedProfile = { ...MOCK_PROFILE, name: 'Alicia' }
    mockPrismaClient.profile.findUnique.mockResolvedValue(MOCK_PROFILE)
    mockPrismaClient.profile.update.mockResolvedValue(updatedProfile)

    const result = await renameProfile('profile-1', 'Alicia')

    expect(mockPrismaClient.profile.update).toHaveBeenCalledWith({
      where: { id: 'profile-1' },
      data: { name: 'Alicia' },
    })
    expect(result).toEqual(updatedProfile)
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('throws when profile belongs to a different user', async () => {
    mockPrismaClient.profile.findUnique.mockResolvedValue({
      ...MOCK_PROFILE,
      userId: 'other-user-id',
    })

    await expect(renameProfile('profile-1', 'Alicia')).rejects.toThrow('Profile not found')

    expect(mockPrismaClient.profile.update).not.toHaveBeenCalled()
  })
})

describe('deleteProfile', () => {
  it('deletes profile and revalidates path', async () => {
    mockPrismaClient.profile.findUnique.mockResolvedValue(MOCK_PROFILE)
    mockPrismaClient.profile.count.mockResolvedValue(2)
    mockPrismaClient.profile.delete.mockResolvedValue(MOCK_PROFILE)

    await deleteProfile('profile-1')

    expect(mockPrismaClient.profile.delete).toHaveBeenCalledWith({ where: { id: 'profile-1' } })
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('throws when trying to delete the last profile', async () => {
    mockPrismaClient.profile.findUnique.mockResolvedValue(MOCK_PROFILE)
    mockPrismaClient.profile.count.mockResolvedValue(1)

    await expect(deleteProfile('profile-1')).rejects.toThrow('Cannot delete your last profile')

    expect(mockPrismaClient.profile.delete).not.toHaveBeenCalled()
  })

  it('throws when profile is not owned by the current user', async () => {
    mockPrismaClient.profile.findUnique.mockResolvedValue({
      ...MOCK_PROFILE,
      userId: 'other-user-id',
    })

    await expect(deleteProfile('profile-1')).rejects.toThrow('Profile not found')

    expect(mockPrismaClient.profile.delete).not.toHaveBeenCalled()
  })
})
