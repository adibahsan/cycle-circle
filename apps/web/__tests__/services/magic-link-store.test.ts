import { describe, it, expect, afterAll } from 'vitest'
import { randomUUID } from 'crypto'
import { testPrisma } from '../helpers/test-db'
import { createMagicLink, findMagicLink } from '@vesta/shared/server/services'

// #258: the requesting page's language is stored on the magic link.
const EMAIL = `ml-lang-${randomUUID()}@example.test`
const expiresAt = () => new Date(Date.now() + 60_000)

afterAll(async () => {
  await testPrisma.magicLink.deleteMany({ where: { email: EMAIL } })
})

describe('magic link language', () => {
  it('stores Bengali and English choices', async () => {
    const bn = randomUUID()
    const en = randomUUID()
    await createMagicLink(EMAIL, bn, expiresAt(), 'bn')
    await createMagicLink(EMAIL, en, expiresAt(), 'en')
    expect((await findMagicLink(bn))?.language).toBe('BN')
    expect((await findMagicLink(en))?.language).toBe('EN')
  })

  it('stores no language when none was chosen', async () => {
    const token = randomUUID()
    await createMagicLink(EMAIL, token, expiresAt())
    expect((await findMagicLink(token))?.language).toBeNull()
  })
})
