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
}))

import { updateNotificationPrefs } from '../../src/app/actions/settings-actions'
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
