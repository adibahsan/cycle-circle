import { vi } from 'vitest'
import type { JwtPayload, AuthUser } from '@vesta/shared/server/auth'

export const MOCK_JWT: JwtPayload = {
  sub: 'test-user-id',
}

export const MOCK_AUTH_USER: AuthUser = {
  id: 'user-1',
  phone: '+8801700000000',
  email: 'test@example.com',
  fullName: 'Test User',
  authMethod: 'PHONE',
  subscriptionStatus: 'FREE',
  profileCompleted: true,
  emailTrialExpiresAt: null,
  role: 'USER',
}

export const mockRequireAuth = vi.fn().mockResolvedValue(MOCK_JWT)
export const mockGetAuthUser = vi.fn().mockResolvedValue(MOCK_AUTH_USER)
