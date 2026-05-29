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

import { completeProfile } from '../../src/app/actions/user-actions'
import { revalidatePath } from 'next/cache'

const MOCK_UPDATED_USER = {
  id: 'user-1',
  fullName: 'Jane Doe',
  phone: '+8801700000001',
  profileCompleted: true,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('completeProfile', () => {
  it('updates user with fullName, phone, and profileCompleted=true', async () => {
    mockPrismaClient.user.update.mockResolvedValue(MOCK_UPDATED_USER)

    const result = await completeProfile({
      fullName: 'Jane Doe',
      phone: '+8801700000001',
    })

    expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        fullName: 'Jane Doe',
        phone: '+8801700000001',
        profileCompleted: true,
      },
    })
    expect(result).toEqual({
      id: 'user-1',
      fullName: 'Jane Doe',
      profileCompleted: true,
    })
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('throws on empty name', async () => {
    await expect(
      completeProfile({ fullName: '', phone: '+8801700000001' }),
    ).rejects.toThrow()

    expect(mockPrismaClient.user.update).not.toHaveBeenCalled()
  })
})
