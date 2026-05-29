import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockPrismaClient } from '../helpers/mock-prisma'
import { MOCK_JWT, MOCK_AUTH_USER } from '../helpers/mock-auth'

// --- mocks ---
vi.mock('@vesta/shared', () => ({ prisma: mockPrismaClient }))
vi.mock('@vesta/shared/server/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue(MOCK_JWT),
  getAuthUser: vi.fn().mockResolvedValue(MOCK_AUTH_USER),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { submitFeedback } from '../../src/app/actions/feedback-actions'
import { revalidatePath } from 'next/cache'

const MOCK_FEEDBACK = {
  id: 'feedback-1',
  userId: 'user-1',
  profileId: null,
  category: 'GENERAL' as const,
  message: 'Great app!',
  rating: 5,
  createdAt: new Date('2026-01-15'),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('submitFeedback', () => {
  it('creates feedback record with correct fields', async () => {
    mockPrismaClient.feedback.create.mockResolvedValue(MOCK_FEEDBACK)

    const result = await submitFeedback({
      category: 'GENERAL',
      message: 'Great app!',
      rating: 5,
    })

    expect(mockPrismaClient.feedback.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        profileId: undefined,
        category: 'GENERAL',
        message: 'Great app!',
        rating: 5,
      },
    })
    expect(result).toEqual(MOCK_FEEDBACK)
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('throws on invalid category', async () => {
    await expect(
      submitFeedback({
        // @ts-expect-error intentionally invalid
        category: 'INVALID_CATEGORY',
        message: 'test',
      }),
    ).rejects.toThrow()

    expect(mockPrismaClient.feedback.create).not.toHaveBeenCalled()
  })
})
