/**
 * Profile helpers for tests that drive flows on dashboard, calendar and symptoms.
 */
import type { Page } from '@playwright/test'
import { db } from './db.ts'

export interface ProfileInput {
  name?: string
  relation?: 'SELF' | 'WIFE' | 'SISTER' | 'MOTHER' | 'DAUGHTER' | 'GIRLFRIEND'
  cycleLength?: number
  periodLength?: number
  lastPeriodStart?: string
  goal?: string
  skipTour?: boolean
}

export interface CreatedProfile {
  id: string
  name: string
  userId: string
  cycleLength: number
  periodLength: number
}

/**
 * Creates a profile for the user in `page.request` via the web app's API.
 * Keeps throwaway tests independent: each gets its own profile.
 * By default marks onboardingTourCompletedAt so the spotlight tour does not
 * block interaction on /dashboard.
 */
export async function setupProfile(page: Page, input: ProfileInput = {}): Promise<CreatedProfile> {
  const res = await page.request.post('/api/profiles', {
    data: {
      name: input.name ?? 'Test Profile',
      relation: input.relation ?? 'SELF',
      cycleLength: input.cycleLength ?? 28,
      periodLength: input.periodLength ?? 5,
      lastPeriodStart: input.lastPeriodStart,
      goal: input.goal ?? 'track_cycle',
    },
  })
  if (!res.ok()) {
    throw new Error(`setupProfile failed (${res.status()}): ${await res.text()}`)
  }
  const body = (await res.json()) as { profile: CreatedProfile }

  if (input.skipTour !== false) {
    await db.user.update({
      where: { id: body.profile.userId },
      data: { onboardingTourCompletedAt: new Date() },
    })
  }

  return body.profile
}
