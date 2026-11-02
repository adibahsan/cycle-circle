import { describe, it, expect, vi, beforeEach } from 'vitest'

// Issue #140: bad magic links redirect to /email-login with an error code, not raw JSON.
const findMagicLink = vi.fn()
const completeMagicLinkAuth = vi.fn()
vi.mock('@vesta/shared/server/services', () => ({
  findMagicLink: (...a: unknown[]) => findMagicLink(...a),
  completeMagicLinkAuth: (...a: unknown[]) => completeMagicLinkAuth(...a),
}))
vi.mock('@vesta/shared/server/auth', () => ({
  WEB_AUDIENCE: 'web',
  issueJwt: vi.fn(async () => 'jwt'),
  setAuthCookie: vi.fn(async () => {}),
}))
// Prod: nginx proxies to the app on localhost:3000; the public origin is APP_URL.
vi.mock('@vesta/shared/utils/env', () => ({ env: { APP_URL: 'https://cycle-circle.com' } }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@/app/api/auth/login-language', () => ({ saveLoginLanguage: vi.fn(async () => {}) }))
vi.mock('@/app/api/auth/log-failure', () => ({ logCustomerRefusal: vi.fn() }))

import { GET } from '@/app/api/auth/magic-link/callback/route'

const call = (qs: string) => GET(new Request(`http://localhost:3000/api/auth/magic-link/callback${qs}`))

describe('magic-link callback failures', () => {
  beforeEach(() => findMagicLink.mockReset())

  it('unknown token -> INVALID_TOKEN', async () => {
    findMagicLink.mockResolvedValue(null)
    const res = await call('?token=nope')
    expect(res.status).toBe(302)
    expect(new URL(res.headers.get('location')!).pathname + new URL(res.headers.get('location')!).search).toBe('/email-login?error=INVALID_TOKEN')
  })

  it('used token -> TOKEN_USED', async () => {
    findMagicLink.mockResolvedValue({ id: 'x', email: 'a@b.c', used: true, expiresAt: new Date(Date.now() + 60_000) })
    const res = await call('?token=t')
    expect(res.headers.get('location')).toContain('/email-login?error=TOKEN_USED')
  })

  it('expired token -> TOKEN_EXPIRED', async () => {
    findMagicLink.mockResolvedValue({ id: 'x', email: 'a@b.c', used: false, expiresAt: new Date(Date.now() - 60_000) })
    const res = await call('?token=t')
    expect(res.headers.get('location')).toContain('/email-login?error=TOKEN_EXPIRED')
  })

  it('missing token -> INVALID_TOKEN', async () => {
    const res = await call('')
    expect(res.headers.get('location')).toContain('/email-login?error=INVALID_TOKEN')
  })
})

describe('magic-link callback redirects to the public origin, not the internal one', () => {
  beforeEach(() => {
    findMagicLink.mockReset()
    completeMagicLinkAuth.mockReset()
  })

  it('success lands on APP_URL', async () => {
    findMagicLink.mockResolvedValue({ id: 'x', email: 'a@b.c', used: false, expiresAt: new Date(Date.now() + 60_000) })
    completeMagicLinkAuth.mockResolvedValue({ id: 'u1', email: 'a@b.c', role: 'USER' })
    const res = await call('?token=t')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://cycle-circle.com/?auth=success')
  })

  it('failure lands on APP_URL', async () => {
    findMagicLink.mockResolvedValue(null)
    const res = await call('?token=nope')
    expect(res.headers.get('location')).toBe('https://cycle-circle.com/email-login?error=INVALID_TOKEN')
  })
})
