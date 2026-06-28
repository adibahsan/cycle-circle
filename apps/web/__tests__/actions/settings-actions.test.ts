import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MOCK_JWT, MOCK_AUTH_USER } from '../helpers/mock-auth'

// --- mocks ---
vi.mock('@vesta/shared/server/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue(MOCK_JWT),
  getAuthUser: vi.fn().mockResolvedValue(MOCK_AUTH_USER),
}))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@vesta/shared/server/services', () => ({
  upsertNotificationPrefs: vi.fn(),
  listProfiles: vi.fn(),
  listPeriodLogs: vi.fn(),
  getSymptomLogs: vi.fn(),
  setProfileReminderOptOut: vi.fn(),
}))

import { updateNotificationPrefs, exportUserDataCsv } from '../../src/app/actions/settings-actions'
import * as svc from '@vesta/shared/server/services'
import { revalidateTag } from 'next/cache'

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
    vi.mocked(svc.upsertNotificationPrefs).mockResolvedValue(MOCK_NOTIF_PREF as never)

    const result = await updateNotificationPrefs({
      profileId: 'profile-1',
      periodAlert: false,
      loggingReminder: false,
    })

    expect(svc.upsertNotificationPrefs).toHaveBeenCalledWith('profile-1', 'user-1', {
      periodAlert: false,
      fertileWindow: undefined,
      loggingReminder: false,
    })
    expect(result).toEqual(MOCK_NOTIF_PREF)
    expect(revalidateTag).toHaveBeenCalledWith('notifications:profile-1', { expire: 0 })
  })

  it('throws when profile is not owned by the current user', async () => {
    vi.mocked(svc.upsertNotificationPrefs).mockRejectedValue(new Error('Profile not found'))

    await expect(
      updateNotificationPrefs({ profileId: 'profile-1', periodAlert: true }),
    ).rejects.toThrow('Profile not found')
  })
})

describe('exportUserDataCsv scoping', () => {
  const p1 = { id: 'p1', name: 'Me', relation: 'SELF' }
  const p2 = { id: 'p2', name: 'Sis', relation: 'SISTER' }
  const p1Log = { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-05'), flowIntensity: 'MEDIUM' }
  const p2Log = { startDate: new Date('2026-02-02'), endDate: new Date('2026-02-06'), flowIntensity: 'LIGHT' }

  beforeEach(() => {
    vi.mocked(svc.listProfiles).mockResolvedValue([p1, p2] as never)
    vi.mocked(svc.listPeriodLogs).mockImplementation((profileId) =>
      Promise.resolve(profileId === 'p1' ? [p1Log] : [p2Log]) as never,
    )
    vi.mocked(svc.getSymptomLogs).mockResolvedValue([] as never)
  })

  it('exports only the requested profile when profileId is provided', async () => {
    const { csv } = await exportUserDataCsv({ profileId: 'p1' })
    expect(csv).toContain('Me')
    expect(csv).toContain('2026-01-01')
    expect(csv).not.toContain('Sis')
    expect(csv).not.toContain('2026-02-02')
  })

  it('exports all profiles when allProfiles: true', async () => {
    const { csv } = await exportUserDataCsv({ allProfiles: true })
    expect(csv).toContain('Me')
    expect(csv).toContain('2026-01-01')
    expect(csv).toContain('Sis')
    expect(csv).toContain('2026-02-02')
  })
})
