import { withAuth } from '@vesta/shared/server/middleware'
import { handleApiError } from '@vesta/shared/server/api-error'
import { prisma } from '@vesta/shared'
import type { AuthUser } from '@vesta/shared/server/auth'

export const GET = withAuth(async (_request, { user }: { user: AuthUser }) => {
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        phone: true,
        email: true,
        fullName: true,
        authMethod: true,
        subscriptionStatus: true,
        profileCompleted: true,
        emailTrialExpiresAt: true,
      },
    })

    return Response.json({ user: dbUser })
  } catch (error) {
    return handleApiError(error)
  }
})
