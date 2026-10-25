import { describe, it, expect, vi } from 'vitest'
import { SignJWT } from 'jose'

// verifyAuth reads the auth cookie; DB and Redis are stubbed so no services are needed.
const cookie = vi.hoisted(() => ({ token: '' }))
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => (cookie.token ? { value: cookie.token } : undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}))
vi.mock('@vesta/shared/server/db', () => ({ prisma: {} }))
vi.mock('@vesta/shared/server/adapters/redis', () => ({
  blacklistJti: vi.fn(),
  isJtiBlacklisted: vi.fn().mockResolvedValue(false),
  getSessionsValidAfterCache: vi.fn().mockResolvedValue(0),
  setSessionsValidAfterCache: vi.fn(),
}))

const { env, parseEnv } = await import('@vesta/shared/utils/env')
const { signAuthToken, verifyAuthToken, authIssuer, WEB_AUDIENCE, ADMIN_AUDIENCE } = await import(
  '@vesta/shared/utils/auth-token'
)
const { verifyAuth, requireAdminAuth } = await import('@vesta/shared/server/auth')

const key = () => new TextEncoder().encode(env.JWT_SECRET)

/** Hand-rolled token so a test can omit or change aud / iss. */
function rawToken(opts: { aud?: string; iss?: string; role?: string }) {
  let jwt = new SignJWT({ role: opts.role ?? 'USER' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user-1')
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime('1h')
  if (opts.aud) jwt = jwt.setAudience(opts.aud)
  if (opts.iss) jwt = jwt.setIssuer(opts.iss)
  return jwt.sign(key())
}

describe('verifyAuthToken', () => {
  it('accepts the right audience and issuer', async () => {
    const token = await signAuthToken({ sub: 'u1' }, WEB_AUDIENCE, 3600)
    const payload = await verifyAuthToken(token, WEB_AUDIENCE)
    expect(payload.sub).toBe('u1')
    expect(payload.aud).toBe('vesta-web')
    expect(payload.iss).toBe(`vesta:${env.APP_ENV}`)
  })

  it('rejects a token for the other app', async () => {
    const token = await signAuthToken({ sub: 'u1' }, ADMIN_AUDIENCE, 3600)
    await expect(verifyAuthToken(token, WEB_AUDIENCE)).rejects.toThrow()
  })

  it('rejects a token from another environment', async () => {
    const token = await rawToken({ aud: 'vesta-web', iss: 'vesta:some-other-env' })
    await expect(verifyAuthToken(token, WEB_AUDIENCE)).rejects.toThrow()
  })

  it('rejects a legacy token without aud or iss', async () => {
    const token = await rawToken({})
    await expect(verifyAuthToken(token, WEB_AUDIENCE)).rejects.toThrow()
  })

  it('rejects a token with aud but no iss, and iss but no aud', async () => {
    await expect(verifyAuthToken(await rawToken({ aud: 'vesta-web' }), WEB_AUDIENCE)).rejects.toThrow()
    await expect(verifyAuthToken(await rawToken({ iss: authIssuer() }), WEB_AUDIENCE)).rejects.toThrow()
  })
})

describe('app boundary', () => {
  it('web verifyAuth rejects an admin-audience ADMIN token', async () => {
    cookie.token = await signAuthToken({ sub: 'a1', role: 'ADMIN' }, ADMIN_AUDIENCE, 3600)
    expect(await verifyAuth()).toBeNull()
  })

  it('web verifyAuth accepts a web token', async () => {
    cookie.token = await signAuthToken({ sub: 'u1' }, WEB_AUDIENCE, 3600)
    expect((await verifyAuth())?.sub).toBe('u1')
  })

  it('requireAdminAuth rejects a web-audience USER token', async () => {
    cookie.token = await signAuthToken({ sub: 'u1', role: 'USER' }, WEB_AUDIENCE, 3600)
    await expect(requireAdminAuth()).rejects.toMatchObject({ statusCode: 401 })
  })

  it('requireAdminAuth rejects a web-audience token even when it claims ADMIN', async () => {
    cookie.token = await signAuthToken({ sub: 'a1', role: 'ADMIN' }, WEB_AUDIENCE, 3600)
    await expect(requireAdminAuth()).rejects.toMatchObject({ statusCode: 401 })
  })

  it('requireAdminAuth accepts an admin-audience ADMIN token', async () => {
    cookie.token = await signAuthToken({ sub: 'a1', role: 'ADMIN' }, ADMIN_AUDIENCE, 3600)
    expect((await requireAdminAuth()).sub).toBe('a1')
  })
})

describe('env validation', () => {
  const base = {
    DATABASE_URL: 'postgresql://x',
    JWT_SECRET: 'a'.repeat(40),
    AUTH_COOKIE_NAME: 'vesta_token',
  }

  it('defaults APP_ENV to local', () => {
    expect(parseEnv(base).APP_ENV).toBe('local')
  })

  it('allows a local-dev secret when APP_ENV is local', () => {
    expect(() =>
      parseEnv({ ...base, JWT_SECRET: 'local-dev-jwt-secret-minimum-32-characters-long' }),
    ).not.toThrow()
  })

  it.each(['production', 'staging'])('rejects a local-dev JWT_SECRET when APP_ENV is %s', (appEnv) => {
    expect(() =>
      parseEnv({ ...base, APP_ENV: appEnv, JWT_SECRET: 'local-dev-jwt-secret-minimum-32-characters-long' }),
    ).toThrow(/local-dev/)
  })

  it('accepts a real secret in production', () => {
    expect(() => parseEnv({ ...base, APP_ENV: 'production' })).not.toThrow()
  })

  it('rejects an unknown APP_ENV', () => {
    expect(() => parseEnv({ ...base, APP_ENV: 'prod' })).toThrow()
  })

  it('requires AUTH_COOKIE_NAME', () => {
    const { AUTH_COOKIE_NAME: _omit, ...rest } = base
    void _omit
    expect(() => parseEnv(rest)).toThrow(/AUTH_COOKIE_NAME/)
  })
})
