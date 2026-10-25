import { test, expect } from '../../support/fixtures'
import { newPhone, toDbPhone } from '../../support/users.ts'
import { SECRETS, URLS } from '../../support/slot.ts'

test.describe('cron: nightly-maintenance', () => {
  test('writes the accuracy snapshot and purges users past the restore window', async ({
    db,
    days,
    request,
  }) => {
    const purgePhone = toDbPhone(newPhone())
    const keepPhone = toDbPhone(newPhone())

    const purgeUser = await db.user.create({
      data: {
        phone: purgePhone,
        authMethod: 'OTP',
        // Strictly before the 30-day cutoff (exactly 30 days is still restorable).
        deletedAt: days.startOf(days.daysAgo(31)),
      },
    })
    const keepUser = await db.user.create({
      data: {
        phone: keepPhone,
        authMethod: 'OTP',
        deletedAt: days.startOf(days.daysAgo(29)),
      },
    })

    const res = await request.post(`${URLS.web}/api/cron/nightly-maintenance`, {
      headers: { authorization: `Bearer ${SECRETS.cronSecret}` },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body).toMatchObject({ snapshotTiers: 2 })
    expect(body.failed ?? 0).toBe(0)

    // Snapshot is keyed by UTC calendar day.
    const utcDay = new Date(new Date().toISOString().slice(0, 10))
    const snaps = await db.predictionAccuracySnapshot.findMany({ where: { date: utcDay } })
    expect(snaps.map((s) => s.tier).sort()).toEqual(['ARIMA', 'AVERAGE'])

    expect(await db.user.findUnique({ where: { id: purgeUser.id } })).toBeNull()
    expect(await db.user.findUnique({ where: { id: keepUser.id } })).toMatchObject({ id: keepUser.id })
  })
})
