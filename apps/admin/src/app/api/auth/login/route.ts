import { NextResponse } from 'next/server'
import { issueJwt, setAuthCookie, verifyAdminLogin } from '@vesta/shared/server/auth'
import { ApiError, handleApiError } from '@vesta/shared/server/api-error'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    if (!email || !password) {
      throw new ApiError(400, 'Email and password are required', 'VALIDATION_ERROR')
    }

    const user = await verifyAdminLogin(email, password)
    const jwt = await issueJwt({ sub: user.id, email: user.email ?? undefined, role: 'ADMIN' })
    await setAuthCookie(jwt)

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
