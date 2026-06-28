import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MOCK_JWT, MOCK_AUTH_USER } from '../helpers/mock-auth'

// --- mocks ---
vi.mock('@vesta/shared/server/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue(MOCK_JWT),
  getAuthUser: vi.fn().mockResolvedValue(MOCK_AUTH_USER),
}))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@vesta/shared/server/services', () => ({
  createPeriodLog: vi.fn(),
  updatePeriodLog: vi.fn(),
  deletePeriodLog: vi.fn(),
  toggleSymptomLog: vi.fn(),
  recalculatePrediction: vi.fn(),
  saveSymptomLogs: vi.fn(),
}))

import {
  createPeriodLog,
  updatePeriodLog,
  deletePeriodLog,
  toggleSymptom,
  saveSymptoms,
} from '../../src/app/actions/tracking-actions'
import * as svc from '@vesta/shared/server/services'
import { revalidateTag } from 'next/cache'

const MOCK_PERIOD_LOG = {
  id: 'log-1',
  profileId: 'profile-1',
  startDate: new Date('2026-01-15'),
  endDate: new Date('2026-01-20'),
  flowIntensity: 'MEDIUM' as const,
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
    vi.mocked(svc.createPeriodLog).mockResolvedValue({
      log: MOCK_PERIOD_LOG,
      shouldRecalcPrediction: true,
    } as never)

    const result = await createPeriodLog({
      profileId: 'profile-1',
      startDate: '2026-01-15',
      endDate: '2026-01-20',
      flowIntensity: 'MEDIUM',
    })

    expect(svc.createPeriodLog).toHaveBeenCalledWith('profile-1', 'user-1', {
      startDate: '2026-01-15',
      endDate: '2026-01-20',
      flowIntensity: 'MEDIUM',
    })
    expect(svc.recalculatePrediction).toHaveBeenCalledWith('profile-1')
    expect(revalidateTag).toHaveBeenCalledWith('tracking:profile-1', { expire: 0 })
    expect(result).toEqual(MOCK_PERIOD_LOG)
  })

  it('throws when endDate is before startDate', async () => {
    vi.mocked(svc.createPeriodLog).mockRejectedValue(
      new Error('End date must be on or after start date'),
    )

    await expect(
      createPeriodLog({
        profileId: 'profile-1',
        startDate: '2026-01-20',
        endDate: '2026-01-15',
        flowIntensity: 'MEDIUM',
      }),
    ).rejects.toThrow('End date must be on or after start date')

    expect(svc.recalculatePrediction).not.toHaveBeenCalled()
  })

  it('throws when profile is not owned by the current user', async () => {
    vi.mocked(svc.createPeriodLog).mockRejectedValue(new Error('Profile not found'))

    await expect(
      createPeriodLog({
        profileId: 'profile-1',
        startDate: '2026-01-15',
        endDate: '2026-01-20',
        flowIntensity: 'MEDIUM',
      }),
    ).rejects.toThrow('Profile not found')

    expect(svc.recalculatePrediction).not.toHaveBeenCalled()
  })
})

describe('updatePeriodLog', () => {
  it('updates fields and enqueues recalc', async () => {
    const updatedLog = { ...MOCK_PERIOD_LOG, flowIntensity: 'HEAVY' as const }
    vi.mocked(svc.updatePeriodLog).mockResolvedValue({
      log: updatedLog,
      profileId: 'profile-1',
      shouldRecalcPrediction: true,
    } as never)

    const result = await updatePeriodLog('log-1', { flowIntensity: 'HEAVY' })

    expect(svc.updatePeriodLog).toHaveBeenCalledWith('log-1', 'user-1', {
      flowIntensity: 'HEAVY',
    })
    expect(svc.recalculatePrediction).toHaveBeenCalledWith('profile-1')
    expect(revalidateTag).toHaveBeenCalledWith('tracking:profile-1', { expire: 0 })
    expect(result).toEqual(updatedLog)
  })

  it('throws when log is not owned by the current user', async () => {
    vi.mocked(svc.updatePeriodLog).mockRejectedValue(new Error('Period log not found'))

    await expect(updatePeriodLog('log-1', { flowIntensity: 'HEAVY' })).rejects.toThrow(
      'Period log not found',
    )

    expect(svc.recalculatePrediction).not.toHaveBeenCalled()
  })
})

describe('deletePeriodLog', () => {
  it('deletes log and enqueues recalc', async () => {
    vi.mocked(svc.deletePeriodLog).mockResolvedValue({
      profileId: 'profile-1',
      shouldRecalcPrediction: true,
    } as never)

    await deletePeriodLog('log-1')

    expect(svc.deletePeriodLog).toHaveBeenCalledWith('log-1', 'user-1')
    expect(svc.recalculatePrediction).toHaveBeenCalledWith('profile-1')
    expect(revalidateTag).toHaveBeenCalledWith('tracking:profile-1', { expire: 0 })
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
    vi.mocked(svc.toggleSymptomLog).mockResolvedValue({
      action: 'created',
      log: MOCK_SYMPTOM_LOG,
    } as never)

    await toggleSymptom(symptomInput)

    expect(svc.toggleSymptomLog).toHaveBeenCalledWith('profile-1', 'user-1', {
      date: '2026-01-15',
      category: 'PHYSICAL',
      symptomId: 'cramps',
      value: 'mild',
    })
    expect(revalidateTag).toHaveBeenCalledWith('symptoms:profile-1', { expire: 0 })
    expect(revalidateTag).toHaveBeenCalledWith('tracking:profile-1', { expire: 0 })
  })

  it('deletes symptom when it already exists', async () => {
    vi.mocked(svc.toggleSymptomLog).mockResolvedValue({ action: 'deleted' } as never)

    await toggleSymptom(symptomInput)

    expect(svc.toggleSymptomLog).toHaveBeenCalledWith('profile-1', 'user-1', {
      date: '2026-01-15',
      category: 'PHYSICAL',
      symptomId: 'cramps',
      value: 'mild',
    })
    expect(revalidateTag).toHaveBeenCalledWith('symptoms:profile-1', { expire: 0 })
    expect(revalidateTag).toHaveBeenCalledWith('tracking:profile-1', { expire: 0 })
  })
})

describe('saveSymptoms', () => {
  it('batches all added and removed into a single service call', async () => {
    vi.mocked(svc.saveSymptomLogs).mockResolvedValue({ added: 2, removed: 1 } as never)

    await saveSymptoms({
      profileId: 'profile-1',
      date: '2026-01-15',
      added: [
        { symptomId: 'cramps', category: 'PHYSICAL', value: 'cramps' },
        { symptomId: 'bloating', category: 'PHYSICAL', value: 'bloating' },
      ],
      removed: ['fatigue'],
    })

    expect(svc.saveSymptomLogs).toHaveBeenCalledTimes(1)
    expect(svc.saveSymptomLogs).toHaveBeenCalledWith('profile-1', MOCK_AUTH_USER.id, {
      date: '2026-01-15',
      added: [
        { symptomId: 'cramps', category: 'PHYSICAL', value: 'cramps' },
        { symptomId: 'bloating', category: 'PHYSICAL', value: 'bloating' },
      ],
      removed: ['fatigue'],
    })
    expect(revalidateTag).toHaveBeenCalledWith('symptoms:profile-1', { expire: 0 })
    expect(revalidateTag).toHaveBeenCalledWith('tracking:profile-1', { expire: 0 })
  })
})
