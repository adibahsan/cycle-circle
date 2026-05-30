import { PrismaClient } from '@prisma/client'

export const testPrisma = new PrismaClient()

const TEST_PREFIX = 'test-pred'

export function testId(suffix: string) {
  return `${TEST_PREFIX}-${suffix}`
}

export async function createTestUser(suffix: string) {
  const userId = testId(`user-${suffix}`)
  const profileId = testId(`profile-${suffix}`)

  const user = await testPrisma.user.create({
    data: {
      id: userId,
      phone: `+88017${suffix.padStart(8, '0')}`,
      fullName: `Test User ${suffix}`,
      authMethod: 'OTP',
      profileCompleted: true,
    },
  })

  const profile = await testPrisma.profile.create({
    data: {
      id: profileId,
      userId: user.id,
      name: 'Test Profile',
      relation: 'SELF',
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: new Date('2026-01-01'),
    },
  })

  return { user, profile }
}

export async function insertPeriodLogs(
  profileId: string,
  startDates: string[],
  periodLength = 5,
) {
  const logs = []
  for (const dateStr of startDates) {
    const startDate = new Date(dateStr)
    startDate.setUTCHours(0, 0, 0, 0)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + periodLength - 1)

    const log = await testPrisma.periodLog.create({
      data: {
        profileId,
        startDate,
        endDate,
        flowIntensity: 'MEDIUM',
      },
    })
    logs.push(log)
  }
  return logs
}

export async function cleanupTestData(userId: string) {
  // Cascade delete: User → Profile → PeriodLog, SymptomLog, Prediction, NotificationPreference
  await testPrisma.user.delete({ where: { id: userId } }).catch(() => {})
  // Clean up any orphan job events created during tests
  await testPrisma.jobEvent.deleteMany({
    where: { payload: { path: ['profileId'], string_starts_with: TEST_PREFIX } },
  }).catch(() => {})
}

export async function cleanupAllTestData() {
  const testUsers = await testPrisma.user.findMany({
    where: { id: { startsWith: TEST_PREFIX } },
    select: { id: true },
  })
  for (const u of testUsers) {
    await testPrisma.user.delete({ where: { id: u.id } }).catch(() => {})
  }
  await testPrisma.jobEvent.deleteMany({
    where: { payload: { path: ['profileId'], string_starts_with: TEST_PREFIX } },
  }).catch(() => {})
}

export async function getPrediction(profileId: string) {
  return testPrisma.prediction.findUnique({ where: { profileId } })
}
