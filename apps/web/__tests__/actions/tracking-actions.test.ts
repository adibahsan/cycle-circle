import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockPrismaClient } from '../helpers/mock-prisma'
import { MOCK_JWT, MOCK_AUTH_USER } from '../helpers/mock-auth'

// --- mocks ---
vi.mock('@vesta/shared', () => ({ prisma: mockPrismaClient }))
vi.mock('@vesta/shared/server/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue(MOCK_JWT),
  getAuthUser: vi.fn().mockResolvedValue(MOCK_AUTH_USER),
}))
vi.mock('@vesta/shared/server/adapters/jobs', () => ({
  enqueueJob: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import {
  createPeriodLog,
  updatePeriodLog,
  deletePeriodLog,
  toggleSymptom,
} from '../../src/app/actions/tracking-actions'
import { enqueueJob } from '@vesta/shared/server/adapters/jobs'
import { revalidatePath } from 'next/cache'

const MOCK_PROFILE = {
  id: 'profile-1',
  userId: 'user-1',
  name: 'Alice',
}

const MOCK_PERIOD_LOG = {
  id: 'log-1',
  profileId: 'profile-1',
  startDate: new Date('2026-01-15'),
  endDate: new Date('2026-01-20'),
  flowIntensity: 'MEDIUM' as const,
}

const MOCK_PERIOD_LOG_WITH_PROFILE = {
  ...MOCK_PERIOD_LOG,
  profile: MOCK_PROFILE,
}

const MOCK_SYMPTOM_LOG = {
  id: 'symptom-1',
  profileId: 'profile-1',
  date: new Date('2026-01-15'),
  category: 'PHYSICAL' as const,
  symptomId: 'cramps',
  value: 'mild',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createPeriodLog', () => {
  it('creates log with correct dates and enqueues prediction recalc', async () => {
    mockPrismaClient.profile.findUnique.mockResolvedValue(MOCK_PROFILE)
    mockPrismaClient.periodLog.create.mockResolvedValue(MOCK_PERIOD_LOG)

    const result = await createPeriodLog({
      profileId: 'profile-1',
      startDate: '2026-01-15',
      endDate: '2026-01-20',
      flowIntensity: 'MEDIUM',
    })

    expect(mockPrismaClient.periodLog.create).toHaveBeenCalledWith({
      data: {
        profileId: 'profile-1',
        startDate: new Date('2026-01-15'),
        endDate: new Date('2026-01-20'),
        flowIntensity: 'MEDIUM',
      },
    })
    expect(enqueueJob).toHaveBeenCalledWith('PREDICTION_RECALC', { profileId: 'profile-1' })
    expect(revalidatePath).toHaveBeenCalledWith('/')
    expect(result).toEqual(MOCK_PERIOD_LOG)
  })

  it('throws when endDate is before startDate', async () => {
    await expect(
      createPeriodLog({
        profileId: 'profile-1',
        startDate: '2026-01-20',
        endDate: '2026-01-15',
        flowIntensity: 'MEDIUM',
      }),
    ).rejects.toThrow('End date must be on or after start date')

    expect(mockPrismaClient.periodLog.create).not.toHaveBeenCalled()
  })

  it('throws when profile is not owned by the current user', async () => {
    mockPrismaClient.profile.findUnique.mockResolvedValue({
      ...MOCK_PROFILE,
      userId: 'other-user-id',
    })

    await expect(
      createPeriodLog({
        profileId: 'profile-1',
        startDate: '2026-01-15',
        endDate: '2026-01-20',
        flowIntensity: 'MEDIUM',
      }),
    ).rejects.toThrow('Profile not found')

    expect(mockPrismaClient.periodLog.create).not.toHaveBeenCalled()
  })
})

describe('updatePeriodLog', () => {
  it('updates fields and enqueues recalc', async () => {
    const updatedLog = { ...MOCK_PERIOD_LOG, flowIntensity: 'HEAVY' as const }
    mockPrismaClient.periodLog.findUnique.mockResolvedValue(MOCK_PERIOD_LOG_WITH_PROFILE)
    mockPrismaClient.periodLog.update.mockResolvedValue(updatedLog)

    const result = await updatePeriodLog('log-1', { flowIntensity: 'HEAVY' })

    expect(mockPrismaClient.periodLog.update).toHaveBeenCalledWith({
      where: { id: 'log-1' },
      data: { flowIntensity: 'HEAVY' },
    })
    expect(enqueueJob).toHaveBeenCalledWith('PREDICTION_RECALC', { profileId: 'profile-1' })
    expect(revalidatePath).toHaveBeenCalledWith('/')
    expect(result).toEqual(updatedLog)
  })

  it('throws when log is not owned by the current user', async () => {
    mockPrismaClient.periodLog.findUnique.mockResolvedValue({
      ...MOCK_PERIOD_LOG_WITH_PROFILE,
      profile: { ...MOCK_PROFILE, userId: 'other-user-id' },
    })

    await expect(updatePeriodLog('log-1', { flowIntensity: 'HEAVY' })).rejects.toThrow(
      'Period log not found',
    )

    expect(mockPrismaClient.periodLog.update).not.toHaveBeenCalled()
  })
})

describe('deletePeriodLog', () => {
  it('deletes log and enqueues recalc', async () => {
    mockPrismaClient.periodLog.findUnique.mockResolvedValue(MOCK_PERIOD_LOG_WITH_PROFILE)
    mockPrismaClient.periodLog.delete.mockResolvedValue(MOCK_PERIOD_LOG)

    await deletePeriodLog('log-1')

    expect(mockPrismaClient.periodLog.delete).toHaveBeenCalledWith({ where: { id: 'log-1' } })
    expect(enqueueJob).toHaveBeenCalledWith('PREDICTION_RECALC', { profileId: 'profile-1' })
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })
})

describe('toggleSymptom', () => {
  const symptomInput = {
    profileId: 'profile-1',
    date: '2026-01-15',
    category: 'PHYSICAL' as const,
    symptomId: 'cramps',
    value: 'mild',
  }

  it('creates symptom when none exists', async () => {
    mockPrismaClient.profile.findUnique.mockResolvedValue(MOCK_PROFILE)
    mockPrismaClient.symptomLog.findFirst.mockResolvedValue(null)
    mockPrismaClient.symptomLog.create.mockResolvedValue(MOCK_SYMPTOM_LOG)

    await toggleSymptom(symptomInput)

    expect(mockPrismaClient.symptomLog.create).toHaveBeenCalledWith({
      data: {
        profileId: 'profile-1',
        date: new Date('2026-01-15'),
        category: 'PHYSICAL',
        symptomId: 'cramps',
        value: 'mild',
      },
    })
    expect(mockPrismaClient.symptomLog.delete).not.toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('deletes symptom when it already exists', async () => {
    mockPrismaClient.profile.findUnique.mockResolvedValue(MOCK_PROFILE)
    mockPrismaClient.symptomLog.findFirst.mockResolvedValue(MOCK_SYMPTOM_LOG)
    mockPrismaClient.symptomLog.delete.mockResolvedValue(MOCK_SYMPTOM_LOG)

    await toggleSymptom(symptomInput)

    expect(mockPrismaClient.symptomLog.delete).toHaveBeenCalledWith({
      where: { id: 'symptom-1' },
    })
    expect(mockPrismaClient.symptomLog.create).not.toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })
})
