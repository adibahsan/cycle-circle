import { describe, it, expect, vi, beforeEach } from 'vitest'

// #254: the magic-link email is in the language of the page it was requested from.
const jar = new Map<string, string>()
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) }),
}))
const sendMagicLinkEmail = vi.fn()
vi.mock('@vesta/shared/server/adapters/mail', () => ({
  sendMagicLinkEmail: (...a: unknown[]) => sendMagicLinkEmail(...a),
}))
vi.mock('@vesta/shared/server/adapters/redis', () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true })) }))
const createMagicLink = vi.fn()
vi.mock('@vesta/shared/server/services', () => ({ createMagicLink: (...a: unknown[]) => createMagicLink(...a) }))
vi.mock('@vesta/shared/utils/env', () => ({ env: { APP_URL: 'https://cycle-circle.com' } }))
vi.mock('@/app/api/auth/log-failure', () => ({ logCustomerRefusal: vi.fn() }))

import { POST } from '@/app/api/auth/magic-link/request/route'

const request = (body: Record<string, unknown>) =>
  POST(new Request('http://localhost:3000/api/auth/magic-link/request', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }))

const sentLanguage = () => sendMagicLinkEmail.mock.calls[0]![2]

beforeEach(() => {
  jar.clear()
  sendMagicLinkEmail.mockReset().mockResolvedValue(undefined)
  createMagicLink.mockReset().mockResolvedValue({})
})

describe('magic-link email language', () => {
  it('uses the language the page sends', async () => {
    jar.set('vesta_lang', 'en')
    await request({ email: 'user@example.com', language: 'bn' })
    expect(sentLanguage()).toBe('bn')
  })

  it('falls back to the vesta_lang cookie when the page sends none', async () => {
    jar.set('vesta_lang', 'bn')
    await request({ email: 'user@example.com' })
    expect(sentLanguage()).toBe('bn')
  })

  it('is English with neither', async () => {
    await request({ email: 'user@example.com' })
    expect(sentLanguage()).toBe('en')
  })
})

// #258: the link is often opened in another browser, so the requesting page's
// language is stored on the link for the callback to save.
const storedLanguage = () => createMagicLink.mock.calls[0]![3]

describe('magic-link stored language', () => {
  it('stores the language the page sends', async () => {
    jar.set('vesta_lang', 'en')
    await request({ email: 'user@example.com', language: 'bn' })
    expect(storedLanguage()).toBe('bn')
  })

  it('stores the vesta_lang cookie when the page sends none', async () => {
    jar.set('vesta_lang', 'bn')
    await request({ email: 'user@example.com' })
    expect(storedLanguage()).toBe('bn')
  })

  it('stores no language when no choice was made', async () => {
    await request({ email: 'user@example.com' })
    expect(storedLanguage()).toBeUndefined()
  })
})
