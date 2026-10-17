import { withAuth } from '@vesta/shared/server/middleware'
import { handleApiError } from '@vesta/shared/server/api-error'
import { getUserById } from '@vesta/shared/server/services'
import type { AuthUser } from '@vesta/shared/server/auth'

/** Fields the client may see. Never spread the DB row: it carries passwordHash, role and moderation state. */
function toStatusUser(u: NonNullable<Awaited<ReturnType<typeof getUserById>>>) {
  return {
    id: u.id,
    phone: u.phone,
    email: u.email,
    fullName: u.fullName,
    language: u.language,
    authMethod: u.authMethod,
    subscriptionStatus: u.subscriptionStatus,
    emailTrialExpiresAt: u.emailTrialExpiresAt,
    profileCompleted: u.profileCompleted,
    onboardingTourCompletedAt: u.onboardingTourCompletedAt,
    createdAt: u.createdAt,
  }
}

export const GET = withAuth(async (_request, { user }: { user: AuthUser }) => {
  try {
    const dbUser = await getUserById(user.id)
    return Response.json({ user: dbUser ? toStatusUser(dbUser) : null })
  } catch (error) {
    return handleApiError(error)
  }
}, { allowExpiredTrial: true })
