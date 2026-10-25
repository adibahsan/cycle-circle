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
    const maePhone = toDbPhone(newPhone())

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

    // Three period starts → one AVERAGE backtest sample: predicted 28d, actual 30d → maeDays includes 2.
    // (Snapshot aggregates every profile in the slot DB; we only require sampleSize>=1 and a finite mae.)
    const maeUser = await db.user.create({
      data: { phone: maePhone, authMethod: 'OTP', profileCompleted: true },
    })
    await db.profile.create({
      data: {
        userId: maeUser.id,
        name: 'MaeSeed',
        relation: 'SELF',
        cycleLength: 28,
        periodLength: 5,
        periodLogs: {
          create: [
            {
              startDate: days.startOf(days.daysAgo(58)),
              endDate: days.startOf(days.daysAgo(54)),
              flowIntensity: 'MEDIUM',
            },
            {
              startDate: days.startOf(days.daysAgo(30)),
              endDate: days.startOf(days.daysAgo(26)),
              flowIntensity: 'MEDIUM',
            },
            {
              startDate: days.startOf(days.daysAgo(0)),
              endDate: days.startOf(days.daysFromNow(4)),
              flowIntensity: 'MEDIUM',
            },
          ],
        },
      },
    })

    // Snapshot is keyed by UTC calendar day; clear tonight so computedAt is from this run.
    const utcDay = new Date(new Date().toISOString().slice(0, 10))
    await db.predictionAccuracySnapshot.deleteMany({ where: { date: utcDay } })

    const started = new Date()
    const res = await request.post(`${URLS.web}/api/cron/nightly-maintenance`, {
      headers: { authorization: `Bearer ${SECRETS.cronSecret}` },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body).toMatchObject({ snapshotTiers: 2 })
    expect(body.failed ?? 0).toBe(0)
    // Other soft-deleted users may exist in the slot DB; only require our purge ran.
    expect(body.purged).toBeGreaterThanOrEqual(1)

    const snaps = await db.predictionAccuracySnapshot.findMany({ where: { date: utcDay } })
    expect(snaps.map((s) => s.tier).sort()).toEqual(['ARIMA', 'AVERAGE'])
    const withSample = snaps.find((s) => s.sampleSize >= 1)
    expect(withSample).toBeTruthy()
    expect(withSample!.maeDays).not.toBeNull()
    expect(typeof withSample!.maeDays).toBe('number')
    expect(withSample!.computedAt.getTime()).toBeGreaterThanOrEqual(started.getTime() - 2_000)

    expect(await db.user.findUnique({ where: { id: purgeUser.id } })).toBeNull()
    expect(await db.user.findUnique({ where: { id: keepUser.id } })).toMatchObject({ id: keepUser.id })
  })
})
