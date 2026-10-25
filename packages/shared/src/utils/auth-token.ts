import { SignJWT, jwtVerify } from 'jose'
import type { JWTPayload } from 'jose'
import { env } from './env'

/**
 * Auth tokens are scoped twice (ADR 0007):
 *  - audience: which app may accept the token (web or admin), decided in code by the caller;
 *  - issuer:   which environment issued it (`vesta:<APP_ENV>`), taken from APP_ENV.
 * Edge-safe (jose only), so both proxies and the server auth helpers share it.
 */
export const WEB_AUDIENCE = 'vesta-web'
export const ADMIN_AUDIENCE = 'vesta-admin'
export type AuthAudience = typeof WEB_AUDIENCE | typeof ADMIN_AUDIENCE

export function authIssuer(): string {
  return `vesta:${env.APP_ENV}`
}

function secret() {
  return new TextEncoder().encode(env.JWT_SECRET)
}

export interface SignTokenInput {
  sub: string
  phone?: string
  email?: string
  role?: string
}

export async function signAuthToken(
  input: SignTokenInput,
  audience: AuthAudience,
  expirySeconds: number,
): Promise<string> {
  return new SignJWT({
    phone: input.phone,
    email: input.email,
    role: input.role ?? 'USER',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.sub)
    .setJti(crypto.randomUUID())
    .setIssuer(authIssuer())
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${expirySeconds}s`)
    .sign(secret())
}

/** Throws unless the signature, expiry, audience and issuer all match. Tokens without `aud`/`iss` are rejected. */
export async function verifyAuthToken(token: string, audience: AuthAudience): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, secret(), {
    algorithms: ['HS256'],
    audience,
    issuer: authIssuer(),
  })
  return payload
}
