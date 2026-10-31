import { NextResponse } from 'next/server'
import { ADMIN_AUDIENCE, ADMIN_JWT_EXPIRY_SECONDS, adminLoginSchema, attemptAdminLogin, issueJwt, setAuthCookie } from '@vesta/shared/server/auth'
import { handleApiError } from '@vesta/shared/server/api-error'
import { requestIp } from '@vesta/shared/server/request-ip'
import { parseBody } from '@vesta/shared/server/validation'

export async function POST(request: Request) {
  try {
    const { email, password } = await parseBody(request, adminLoginSchema)

    const user = await attemptAdminLogin({ email, password, ip: requestIp(request), now: new Date() })
    const jwt = await issueJwt({ sub: user.id, email: user.email ?? undefined, role: 'ADMIN' }, ADMIN_AUDIENCE, ADMIN_JWT_EXPIRY_SECONDS)
    await setAuthCookie(jwt, ADMIN_JWT_EXPIRY_SECONDS)

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
