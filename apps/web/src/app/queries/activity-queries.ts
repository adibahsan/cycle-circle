import { after } from 'next/server'
import { recordUserActivity } from '@vesta/shared/server/services'
import { getCurrentUser } from '@/app/queries/auth-queries'

/**
 * Active user (GLOSSARY): a signed-in customer opening the app on a Bangladesh day.
 * Call from every signed-in layout (`(main)` and `onboarding`); recording runs after the
 * response and is once per user per day. The admin app never calls it, so admins don't count.
 */
export async function recordSignedInActivity(): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return
  const now = new Date()
  after(() => recordUserActivity(user.id, now).catch(() => {}))
}
