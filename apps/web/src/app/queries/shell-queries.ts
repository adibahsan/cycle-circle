import { cookies } from 'next/headers'
import {
  getUserById,
  getLoggingStatus,
  getProfileCompletionStatus,
} from '@vesta/shared/server/services'
import type { ShellInitial } from '@/lib/shell-initial'
import { getCurrentUser } from './auth-queries'
import { getProfiles } from './profile-queries'

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null)

/**
 * Same data as /api/auth/status, /api/tracking/logging-status and /api/profile/completion,
 * with the same `vesta_active_profile` cookie resolution, for the shell to apply on mount.
 */
export async function getShellInitial(): Promise<ShellInitial | null> {
  try {
    const authUser = await getCurrentUser()
    if (!authUser) return null
    const [profiles, cookieStore, dbUser] = await Promise.all([
      getProfiles(),
      cookies(),
      getUserById(authUser.id),
    ])
    const cookieId = cookieStore.get('vesta_active_profile')?.value
    const active =
      (cookieId && profiles.find((p) => p.id === cookieId)) || profiles[0] || null
    const [status, completion] = await Promise.all([
      active ? getLoggingStatus(active.id, authUser.id, new Date()) : null,
      getProfileCompletionStatus(
        authUser.id,
        cookieId && profiles.some((p) => p.id === cookieId) ? cookieId : undefined,
      ),
    ])
    return {
      user: dbUser
        ? {
            id: dbUser.id,
            createdAt: iso(dbUser.createdAt),
            onboardingTourCompletedAt: iso(dbUser.onboardingTourCompletedAt),
            authMethod: dbUser.authMethod,
            subscriptionStatus: dbUser.subscriptionStatus,
            emailTrialExpiresAt: iso(dbUser.emailTrialExpiresAt),
          }
        : null,
      logging: {
        goal: null,
        loggedToday: false,
        isPeriodLate: false,
        daysLate: 0,
        ...(status ?? {}),
        profileId: active?.id ?? null,
      },
      completion,
      activeProfile: active ? { id: active.id, name: active.name } : null,
    }
  } catch {
    return null
  }
}
