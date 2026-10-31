import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createPeriodLog, updatePeriodLog } from '@vesta/shared/server/services'
import { ApiError } from '@vesta/shared/server/api-error'
import { cleanupTestData, createTestUser, testId, testPrisma } from '../helpers/test-db'

// 2026-10-26T20:30Z is already 2026-10-27 02:30 in Bangladesh.
const NOW = new Date('2026-10-26T20:30:00Z')
const SUFFIX = 'plfut'

async function code(p: Promise<unknown>) {
  try {
    await p
  } catch (e) {
    return e instanceof ApiError ? [e.statusCode, e.code] : String(e)
  }
  return null
}

describe('period logs reject future days (#139)', () => {
  let userId: string
  let profileId: string

  beforeAll(async () => {
    await cleanupTestData(testId(`user-${SUFFIX}`)).catch(() => {})
    const { user, profile } = await createTestUser(SUFFIX)
    userId = user.id
    profileId = profile.id
  })
  afterAll(async () => {
    await cleanupTestData(testId(`user-${SUFFIX}`)).catch(() => {})
  })

  it('rejects a start after the Bangladesh day with 400 PERIOD_IN_FUTURE', async () => {
    expect(
      await code(createPeriodLog(profileId, userId, { startDate: '2026-10-28', endDate: '2026-10-29', flowIntensity: 'LIGHT' }, NOW)),
    ).toEqual([400, 'PERIOD_IN_FUTURE'])
  })

  it('rejects a future end date', async () => {
    expect(
      await code(createPeriodLog(profileId, userId, { startDate: '2026-10-25', endDate: '2026-10-28', flowIntensity: 'LIGHT' }, NOW)),
    ).toEqual([400, 'PERIOD_IN_FUTURE'])
  })

  it('allows today in Bangladesh even though it is tomorrow in UTC', async () => {
    const { log } = await createPeriodLog(profileId, userId, { startDate: '2026-10-25', endDate: '2026-10-27', flowIntensity: 'LIGHT' }, NOW)
    expect(log.id).toBeTruthy()

    expect(
      await code(updatePeriodLog(log.id, userId, { endDate: '2026-10-28' }, NOW)),
    ).toEqual([400, 'PERIOD_IN_FUTURE'])
    expect(await code(updatePeriodLog(log.id, userId, { flowIntensity: 'HEAVY' }, NOW))).toBeNull()
    await testPrisma.periodLog.deleteMany({ where: { profileId } })
  })
})
