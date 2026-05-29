import { vi } from 'vitest'

function makeModelMock() {
  return {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
  }
}

export function createMockPrismaClient() {
  return {
    profile: makeModelMock(),
    periodLog: makeModelMock(),
    symptomLog: makeModelMock(),
    prediction: makeModelMock(),
    notificationPreference: makeModelMock(),
    feedback: makeModelMock(),
    user: makeModelMock(),
  }
}

export const mockPrismaClient = createMockPrismaClient()
