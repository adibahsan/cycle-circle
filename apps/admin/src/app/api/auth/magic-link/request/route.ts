import { NextResponse } from 'next/server'
import { prisma } from '@vesta/shared'
import { ApiError, handleApiError } from '@vesta/shared/server/api-error'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    if (!email) throw new ApiError(400, 'Email required', 'VALIDATION_ERROR')

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || user.role !== 'ADMIN') {
      // Don't reveal whether the user exists
      return NextResponse.json({
        message: 'If an admin account exists, a login link has been sent.',
      })
    }

    // Generate magic link token
    const token = crypto.randomUUID()
    await prisma.magicLink.create({
      data: {
        userId: user.id,
        email,
        token,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
      },
    })

    // In production, send email via Resend. For now, log the URL.
    const callbackUrl = `${process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001'}/api/auth/magic-link/callback?token=${token}`
    console.log(`[Admin Magic Link] ${callbackUrl}`)

    return NextResponse.json({
      message: 'If an admin account exists, a login link has been sent.',
    })
  } catch (error) {
    return handleApiError(error)
  }
}
