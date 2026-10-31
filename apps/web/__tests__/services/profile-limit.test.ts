import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@vesta/shared'
import { createProfile } from '@vesta/shared/server/services'
import { ApiError } from '@vesta/shared/server/api-error'

// Issue #137: the 7th profile must be a 409 client error, not a plain Error (500).
const userId = `profile-limit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

describe('createProfile profile limit', () => {
  beforeAll(async () => {
    await prisma.user.create({
      data: { id: userId, email: `${userId}@example.com`, authMethod: 'EMAIL' },
    })
  })

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined)
  })

  it('throws ApiError 409 PROFILE_LIMIT_REACHED on the 7th profile', async () => {
    for (let i = 1; i <= 6; i++) {
      await createProfile(userId, { name: `Member ${i}`, relation: i === 1 ? 'SELF' : 'SISTER' })
    }
    const err = await createProfile(userId, { name: 'Member 7', relation: 'SISTER' }).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.statusCode).toBe(409)
    expect(err.code).toBe('PROFILE_LIMIT_REACHED')
    expect(err.message).toBe('You can have up to 6 profiles. Delete one to add another.')
  })
})
