import { withAuth } from '@/server/middleware'
import { handleApiError } from '@/server/api-error'
import { prisma } from '@/server/db'
import type { AuthUser } from '@/server/auth'

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
