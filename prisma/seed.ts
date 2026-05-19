import { PrismaClient, AuthMethod, ProfileRelation, FlowIntensity, PredictionTier } from '@prisma/client'

const prisma = new PrismaClient()

/** Subtract `months` from a date, returning a new Date. */
function subMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() - months)
  return d
}

/** Add `days` to a date, returning a new Date. */
function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

async function main() {
  console.log('Seeding database…')

  // ── Demo User ──────────────────────────────────────────────────────────────
  const demoUser = await prisma.user.upsert({
    where: { phone: 'tel:8801712345678' },
    update: {},
    create: {
      phone: 'tel:8801712345678',
      fullName: 'Demo User',
      authMethod: AuthMethod.OTP,
      profileCompleted: true,
    },
  })

  console.log(`User upserted: ${demoUser.id}`)

  // ── Profiles ───────────────────────────────────────────────────────────────
  const selfProfile = await prisma.profile.upsert({
    where: {
      // Stable upsert key: use a unique combination stored in a unique index.
      // We use a composite unique constraint below via a generated helper —
      // but since Prisma doesn't allow compound unique here without a @@unique,
      // we fall back to findFirst + create pattern wrapped in a transaction.
      // For idempotency we use the id derived from deterministic seed values.
      id: `seed-profile-self-${demoUser.id}`,
    },
    update: {},
    create: {
      id: `seed-profile-self-${demoUser.id}`,
      userId: demoUser.id,
      name: 'Demo User',
      relation: ProfileRelation.SELF,
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: subMonths(new Date(), 1),
    },
  })

  const wifeProfile = await prisma.profile.upsert({
    where: { id: `seed-profile-wife-${demoUser.id}` },
    update: {},
    create: {
      id: `seed-profile-wife-${demoUser.id}`,
      userId: demoUser.id,
      name: 'Demo Wife',
      relation: ProfileRelation.WIFE,
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: subMonths(new Date(), 1),
    },
  })

  console.log(`Profiles upserted: ${selfProfile.id}, ${wifeProfile.id}`)

  // ── Period Logs (last 3 months, ~28-day cycles) ────────────────────────────
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const periodLogSeeds = [
    {
      id: `seed-period-log-1-${selfProfile.id}`,
      profileId: selfProfile.id,
      startDate: subMonths(today, 3),
      endDate: addDays(subMonths(today, 3), 4),
      flowIntensity: FlowIntensity.MEDIUM,
    },
    {
      id: `seed-period-log-2-${selfProfile.id}`,
      profileId: selfProfile.id,
      startDate: subMonths(today, 2),
      endDate: addDays(subMonths(today, 2), 4),
      flowIntensity: FlowIntensity.HEAVY,
    },
    {
      id: `seed-period-log-3-${selfProfile.id}`,
      profileId: selfProfile.id,
      startDate: subMonths(today, 1),
      endDate: addDays(subMonths(today, 1), 4),
      flowIntensity: FlowIntensity.LIGHT,
    },
  ]

  await prisma.$transaction(
    periodLogSeeds.map((log) =>
      prisma.periodLog.upsert({
        where: { id: log.id },
        update: {},
        create: log,
      }),
    ),
  )

  console.log(`Period logs upserted: ${periodLogSeeds.length}`)

  // ── Prediction (Tier 1 / AVERAGE) ──────────────────────────────────────────
  const nextPeriodStart = addDays(subMonths(today, 1), 28)
  const ovulationDay = addDays(nextPeriodStart, -14)
  const fertileStart = addDays(ovulationDay, -5)
  const fertileEnd = addDays(ovulationDay, 1)

  await prisma.prediction.upsert({
    where: { profileId: selfProfile.id },
    update: {
      tier: PredictionTier.AVERAGE,
      nextPeriodStart,
      ovulationDay,
      fertileStart,
      fertileEnd,
      confidence: 0.75,
    },
    create: {
      profileId: selfProfile.id,
      tier: PredictionTier.AVERAGE,
      nextPeriodStart,
      ovulationDay,
      fertileStart,
      fertileEnd,
      confidence: 0.75,
    },
  })

  console.log('Prediction upserted for self profile')

  // ── Notification Preferences ───────────────────────────────────────────────
  await prisma.$transaction([
    prisma.notificationPreference.upsert({
      where: { profileId: selfProfile.id },
      update: {},
      create: {
        profileId: selfProfile.id,
        periodAlert: true,
        fertileWindow: true,
        loggingReminder: true,
      },
    }),
    prisma.notificationPreference.upsert({
      where: { profileId: wifeProfile.id },
      update: {},
      create: {
        profileId: wifeProfile.id,
        periodAlert: true,
        fertileWindow: true,
        loggingReminder: true,
      },
    }),
  ])

  console.log('Notification preferences upserted for both profiles')
  console.log('Seeding complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
