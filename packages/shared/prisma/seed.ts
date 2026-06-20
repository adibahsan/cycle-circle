import {
  PrismaClient,
  AuthMethod,
  ProfileRelation,
  FlowIntensity,
  PredictionTier,
  SubscriptionStatus,
  SymptomCategory,
} from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@vesta.health'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123'

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

/** Return a midnight-UTC Date that is `n` days before today. */
function daysAgo(n: number): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

// ─── Dummy-user seed helpers ─────────────────────────────────────────────────

/** Upsert a NotificationPreference for a profile (mirrors existing pattern). */
async function seedNotifPref(profileId: string) {
  await prisma.notificationPreference.upsert({
    where: { profileId },
    update: {},
    create: {
      profileId,
      periodAlert: true,
      fertileWindow: true,
      loggingReminder: true,
    },
  })
}

/** Upsert a Prediction for a profile (mirrors existing seedPrediction). */
async function seedPred(
  profileId: string,
  lastPeriodStart: Date,
  cycleLength: number,
  tier: PredictionTier = PredictionTier.AVERAGE,
  confidence = 0.75,
) {
  const nextPeriodStart = addDays(lastPeriodStart, cycleLength)
  const ovulationDay = addDays(nextPeriodStart, -14)
  const fertileStart = addDays(ovulationDay, -5)
  const fertileEnd = addDays(ovulationDay, 1)
  await prisma.prediction.upsert({
    where: { profileId },
    update: { tier, nextPeriodStart, ovulationDay, fertileStart, fertileEnd, confidence },
    create: { profileId, tier, nextPeriodStart, ovulationDay, fertileStart, fertileEnd, confidence },
  })
}

/**
 * Upsert SymptomLog rows for a list of {daysBack, symptomId, category, value} entries.
 * Uses deterministic IDs so re-runs are safe.
 */
async function seedSymptomLogs(
  profileId: string,
  entries: Array<{
    daysBack: number
    symptomId: string
    category: SymptomCategory
    value: string
  }>,
) {
  for (const { daysBack, symptomId, category, value } of entries) {
    const date = daysAgo(daysBack)
    const id = `seed-sym-${profileId}-d${daysBack}-${symptomId}`
    await prisma.symptomLog.upsert({
      where: { id },
      update: {},
      create: { id, profileId, date, category, symptomId, value },
    })
  }
}

/**
 * Upsert PeriodLog rows. Each entry needs {idx, startDaysAgo, durationDays, flow}.
 * Uses deterministic IDs.
 */
async function seedPeriodLogs(
  profileId: string,
  entries: Array<{
    idx: number
    startDaysAgo: number
    durationDays: number
    flow: FlowIntensity
  }>,
) {
  for (const { idx, startDaysAgo, durationDays, flow } of entries) {
    const startDate = daysAgo(startDaysAgo)
    const endDate = addDays(startDate, durationDays - 1)
    const id = `seed-period-${profileId}-${idx}`
    await prisma.periodLog.upsert({
      where: { id },
      update: {},
      create: { id, profileId, startDate, endDate, flowIntensity: flow },
    })
  }
}

// ─── The main dummy-user factory ─────────────────────────────────────────────

async function seedDummyUsers() {
  console.log('  [dummy] Seeding dummy engagement/streak test users…')

  // ── 1. Active Streaker ── OTP, 7-day consecutive symptom streak ─────────────
  const streaker = await prisma.user.upsert({
    where: { phone: '+8801700000001' },
    update: {},
    create: {
      phone: '+8801700000001',
      fullName: 'Rina Akter (Streaker)',
      authMethod: AuthMethod.OTP,
      profileCompleted: true,
      language: 'EN',
    },
  })
  const streakerProfile = await prisma.profile.upsert({
    where: { id: `seed-dummy-streaker-${streaker.id}` },
    update: {},
    create: {
      id: `seed-dummy-streaker-${streaker.id}`,
      userId: streaker.id,
      name: 'Rina',
      relation: ProfileRelation.SELF,
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: daysAgo(10),
      goal: 'tracking',
    },
  })
  await seedPeriodLogs(streakerProfile.id, [
    { idx: 1, startDaysAgo: 10, durationDays: 5, flow: FlowIntensity.MEDIUM },
  ])
  // 7 consecutive symptom logs: today (0) through 6 days ago
  await seedSymptomLogs(streakerProfile.id, [
    { daysBack: 0, symptomId: 'cramps',      category: SymptomCategory.PHYSICAL, value: 'mild' },
    { daysBack: 1, symptomId: 'headache',    category: SymptomCategory.PHYSICAL, value: 'moderate' },
    { daysBack: 2, symptomId: 'fatigue',     category: SymptomCategory.PHYSICAL, value: 'high' },
    { daysBack: 3, symptomId: 'bloating',    category: SymptomCategory.PHYSICAL, value: 'mild' },
    { daysBack: 4, symptomId: 'mood-swings', category: SymptomCategory.MOOD,     value: 'present' },
    { daysBack: 5, symptomId: 'irritable',   category: SymptomCategory.MOOD,     value: 'present' },
    { daysBack: 6, symptomId: 'backache',    category: SymptomCategory.PHYSICAL, value: 'mild' },
  ])
  await seedPred(streakerProfile.id, daysAgo(10), 28)
  await seedNotifPref(streakerProfile.id)
  console.log('  [dummy] 1. Active Streaker: +8801700000001')

  // ── 2. "All Good" Streaker ── 5-day streak mixing all_good sentinel ─────────
  const allGoodUser = await prisma.user.upsert({
    where: { phone: '+8801700000002' },
    update: {},
    create: {
      phone: '+8801700000002',
      fullName: 'Sultana Begum (AllGood)',
      authMethod: AuthMethod.OTP,
      profileCompleted: true,
      language: 'BN',
    },
  })
  const allGoodProfile = await prisma.profile.upsert({
    where: { id: `seed-dummy-allgood-${allGoodUser.id}` },
    update: {},
    create: {
      id: `seed-dummy-allgood-${allGoodUser.id}`,
      userId: allGoodUser.id,
      name: 'Sultana',
      relation: ProfileRelation.SELF,
      cycleLength: 29,
      periodLength: 4,
      lastPeriodStart: daysAgo(15),
      goal: 'tracking',
    },
  })
  await seedPeriodLogs(allGoodProfile.id, [
    { idx: 1, startDaysAgo: 15, durationDays: 4, flow: FlowIntensity.LIGHT },
  ])
  // Mix of real symptoms and all_good sentinel over last 5 days (today through 4 days ago)
  await seedSymptomLogs(allGoodProfile.id, [
    { daysBack: 0, symptomId: 'all_good',  category: SymptomCategory.MOOD,     value: 'all_good' },
    { daysBack: 1, symptomId: 'calm',      category: SymptomCategory.MOOD,     value: 'present' },
    { daysBack: 2, symptomId: 'all_good',  category: SymptomCategory.MOOD,     value: 'all_good' },
    { daysBack: 3, symptomId: 'energetic', category: SymptomCategory.MOOD,     value: 'present' },
    { daysBack: 4, symptomId: 'all_good',  category: SymptomCategory.MOOD,     value: 'all_good' },
  ])
  await seedPred(allGoodProfile.id, daysAgo(15), 29)
  await seedNotifPref(allGoodProfile.id)
  console.log('  [dummy] 2. All-Good Streaker: +8801700000002')

  // ── 3. Stale User ── last log was 8 days ago, streak = 0 ───────────────────
  const staleUser = await prisma.user.upsert({
    where: { phone: '+8801700000003' },
    update: {},
    create: {
      phone: '+8801700000003',
      fullName: 'Nasrin Jahan (Stale)',
      authMethod: AuthMethod.OTP,
      profileCompleted: true,
      language: 'EN',
    },
  })
  const staleProfile = await prisma.profile.upsert({
    where: { id: `seed-dummy-stale-${staleUser.id}` },
    update: {},
    create: {
      id: `seed-dummy-stale-${staleUser.id}`,
      userId: staleUser.id,
      name: 'Nasrin',
      relation: ProfileRelation.SELF,
      cycleLength: 27,
      periodLength: 5,
      lastPeriodStart: daysAgo(20),
      goal: 'tracking',
    },
  })
  await seedPeriodLogs(staleProfile.id, [
    { idx: 1, startDaysAgo: 48, durationDays: 5, flow: FlowIntensity.MEDIUM },
    { idx: 2, startDaysAgo: 20, durationDays: 5, flow: FlowIntensity.HEAVY },
  ])
  // Symptom logs that stop 8 days ago — no recent activity, triggers stale nudge
  await seedSymptomLogs(staleProfile.id, [
    { daysBack: 8,  symptomId: 'cramps',   category: SymptomCategory.PHYSICAL, value: 'mild' },
    { daysBack: 9,  symptomId: 'fatigue',  category: SymptomCategory.PHYSICAL, value: 'high' },
    { daysBack: 12, symptomId: 'headache', category: SymptomCategory.PHYSICAL, value: 'moderate' },
  ])
  await seedPred(staleProfile.id, daysAgo(20), 27)
  await seedNotifPref(staleProfile.id)
  console.log('  [dummy] 3. Stale User (no logs in 8+ days): +8801700000003')

  // ── 4. Power User / Tier-2 (ARIMA) ── 8+ period logs, high confidence ──────
  const powerUser = await prisma.user.upsert({
    where: { phone: '+8801700000004' },
    update: {},
    create: {
      phone: '+8801700000004',
      fullName: 'Farida Khanam (Power)',
      authMethod: AuthMethod.OTP,
      profileCompleted: true,
      language: 'EN',
    },
  })
  const powerProfile = await prisma.profile.upsert({
    where: { id: `seed-dummy-power-${powerUser.id}` },
    update: {},
    create: {
      id: `seed-dummy-power-${powerUser.id}`,
      userId: powerUser.id,
      name: 'Farida',
      relation: ProfileRelation.SELF,
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: daysAgo(5),
      goal: 'tracking',
    },
  })
  // 8 period logs spanning ~8 months back with ~28-30 day gaps
  await seedPeriodLogs(powerProfile.id, [
    { idx: 1, startDaysAgo: 233, durationDays: 5, flow: FlowIntensity.MEDIUM },
    { idx: 2, startDaysAgo: 204, durationDays: 5, flow: FlowIntensity.HEAVY },
    { idx: 3, startDaysAgo: 174, durationDays: 5, flow: FlowIntensity.MEDIUM },
    { idx: 4, startDaysAgo: 145, durationDays: 4, flow: FlowIntensity.LIGHT },
    { idx: 5, startDaysAgo: 116, durationDays: 5, flow: FlowIntensity.MEDIUM },
    { idx: 6, startDaysAgo:  87, durationDays: 5, flow: FlowIntensity.HEAVY },
    { idx: 7, startDaysAgo:  57, durationDays: 5, flow: FlowIntensity.MEDIUM },
    { idx: 8, startDaysAgo:  28, durationDays: 4, flow: FlowIntensity.LIGHT },
    { idx: 9, startDaysAgo:   5, durationDays: 5, flow: FlowIntensity.MEDIUM },
  ])
  // Recent symptom logs (last 4 days)
  await seedSymptomLogs(powerProfile.id, [
    { daysBack: 0, symptomId: 'cramps',   category: SymptomCategory.PHYSICAL, value: 'moderate' },
    { daysBack: 1, symptomId: 'bloating', category: SymptomCategory.PHYSICAL, value: 'mild' },
    { daysBack: 2, symptomId: 'fatigue',  category: SymptomCategory.PHYSICAL, value: 'high' },
    { daysBack: 3, symptomId: 'headache', category: SymptomCategory.PHYSICAL, value: 'moderate' },
  ])
  // ARIMA tier, high confidence (6+ cycles logged)
  await seedPred(powerProfile.id, daysAgo(5), 28, PredictionTier.ARIMA, 0.92)
  await seedNotifPref(powerProfile.id)
  console.log('  [dummy] 4. Power User (ARIMA, 9 period logs): +8801700000004')

  // ── 5. Brand-New User ── 1 profile, 1 period log, no symptoms (Tier-1) ──────
  const newUser = await prisma.user.upsert({
    where: { phone: '+8801700000005' },
    update: {},
    create: {
      phone: '+8801700000005',
      fullName: 'Mitu Akter (NewUser)',
      authMethod: AuthMethod.OTP,
      profileCompleted: true,
      language: 'BN',
    },
  })
  const newProfile = await prisma.profile.upsert({
    where: { id: `seed-dummy-new-${newUser.id}` },
    update: {},
    create: {
      id: `seed-dummy-new-${newUser.id}`,
      userId: newUser.id,
      name: 'Mitu',
      relation: ProfileRelation.SELF,
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: daysAgo(3),
      goal: 'tracking',
    },
  })
  await seedPeriodLogs(newProfile.id, [
    { idx: 1, startDaysAgo: 3, durationDays: 5, flow: FlowIntensity.MEDIUM },
  ])
  // No symptom logs — empty-state nudge scenario
  await seedPred(newProfile.id, daysAgo(3), 28, PredictionTier.AVERAGE, 0.60)
  await seedNotifPref(newProfile.id)
  console.log('  [dummy] 5. Brand-New User (no symptoms, Tier-1): +8801700000005')

  // ── 6. Email-Trial User ── EMAIL auth, trial expires in ~12 hours ───────────
  const trialExpiry = new Date(Date.now() + 12 * 60 * 60 * 1000) // 12h from now
  const emailTrialUser = await prisma.user.upsert({
    where: { email: 'trial@vesta.test' },
    update: { emailTrialExpiresAt: trialExpiry },
    create: {
      email: 'trial@vesta.test',
      fullName: 'Shirin Islam (EmailTrial)',
      authMethod: AuthMethod.EMAIL,
      profileCompleted: true,
      language: 'EN',
      emailTrialExpiresAt: trialExpiry,
    },
  })
  const trialProfile = await prisma.profile.upsert({
    where: { id: `seed-dummy-trial-${emailTrialUser.id}` },
    update: {},
    create: {
      id: `seed-dummy-trial-${emailTrialUser.id}`,
      userId: emailTrialUser.id,
      name: 'Shirin',
      relation: ProfileRelation.SELF,
      cycleLength: 30,
      periodLength: 5,
      lastPeriodStart: daysAgo(7),
      goal: 'tracking',
    },
  })
  await seedPeriodLogs(trialProfile.id, [
    { idx: 1, startDaysAgo: 7, durationDays: 5, flow: FlowIntensity.LIGHT },
  ])
  await seedSymptomLogs(trialProfile.id, [
    { daysBack: 0, symptomId: 'happy', category: SymptomCategory.MOOD, value: 'present' },
    { daysBack: 1, symptomId: 'calm',  category: SymptomCategory.MOOD, value: 'present' },
  ])
  await seedPred(trialProfile.id, daysAgo(7), 30)
  await seedNotifPref(trialProfile.id)
  console.log('  [dummy] 6. Email-Trial User (expires ~12h): trial@vesta.test')

  // ── 8. Expired Email-Trial User ── EMAIL auth, trial expired 24h ago ─────────
  const expiredTrialExpiry = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24h in the past
  const expiredTrialUser = await prisma.user.upsert({
    where: { email: 'trial-expired@vesta.test' },
    update: { emailTrialExpiresAt: expiredTrialExpiry },
    create: {
      email: 'trial-expired@vesta.test',
      fullName: 'Tahmina Akter (TrialExpired)',
      authMethod: AuthMethod.EMAIL,
      profileCompleted: true,
      language: 'EN',
      emailTrialExpiresAt: expiredTrialExpiry,
    },
  })
  const expiredTrialProfile = await prisma.profile.upsert({
    where: { id: `seed-dummy-trial-expired-${expiredTrialUser.id}` },
    update: {},
    create: {
      id: `seed-dummy-trial-expired-${expiredTrialUser.id}`,
      userId: expiredTrialUser.id,
      name: 'Tahmina',
      relation: ProfileRelation.SELF,
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: daysAgo(10),
      goal: 'tracking',
    },
  })
  await seedPeriodLogs(expiredTrialProfile.id, [
    { idx: 1, startDaysAgo: 38, durationDays: 5, flow: FlowIntensity.MEDIUM },
    { idx: 2, startDaysAgo: 10, durationDays: 5, flow: FlowIntensity.LIGHT },
  ])
  await seedSymptomLogs(expiredTrialProfile.id, [
    { daysBack: 0, symptomId: 'cramps', category: SymptomCategory.PHYSICAL, value: 'mild' },
    { daysBack: 1, symptomId: 'tired',  category: SymptomCategory.PHYSICAL, value: 'present' },
  ])
  await seedPred(expiredTrialProfile.id, daysAgo(10), 28)
  await seedNotifPref(expiredTrialProfile.id)
  console.log('  [dummy] 8. Expired Email-Trial User: trial-expired@vesta.test')

  // ── 7. Pro Multi-Profile User ── subscriptionStatus PRO, 3 profiles ─────────
  const proUser = await prisma.user.upsert({
    where: { phone: '+8801700000007' },
    update: { subscriptionStatus: SubscriptionStatus.PRO },
    create: {
      phone: '+8801700000007',
      fullName: 'Karim Hossain (Pro)',
      authMethod: AuthMethod.OTP,
      profileCompleted: true,
      language: 'EN',
      subscriptionStatus: SubscriptionStatus.PRO,
    },
  })
  // Subscription row
  await prisma.subscription.upsert({
    where: { id: `seed-sub-pro-${proUser.id}` },
    update: {},
    create: {
      id: `seed-sub-pro-${proUser.id}`,
      userId: proUser.id,
      status: SubscriptionStatus.PRO,
      adminOverride: true,
      adminOverrideAt: new Date(),
    },
  })

  // Profile A: SELF (wife managed by husband account — cycle tracking)
  const proSelf = await prisma.profile.upsert({
    where: { id: `seed-dummy-pro-self-${proUser.id}` },
    update: {},
    create: {
      id: `seed-dummy-pro-self-${proUser.id}`,
      userId: proUser.id,
      name: 'Roksana (Self)',
      relation: ProfileRelation.SELF,
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: daysAgo(8),
      goal: 'tracking',
    },
  })
  await seedPeriodLogs(proSelf.id, [
    { idx: 1, startDaysAgo: 64, durationDays: 5, flow: FlowIntensity.MEDIUM },
    { idx: 2, startDaysAgo: 36, durationDays: 5, flow: FlowIntensity.HEAVY },
    { idx: 3, startDaysAgo:  8, durationDays: 5, flow: FlowIntensity.MEDIUM },
  ])
  await seedSymptomLogs(proSelf.id, [
    { daysBack: 0, symptomId: 'cramps',      category: SymptomCategory.PHYSICAL, value: 'severe' },
    { daysBack: 1, symptomId: 'bloating',    category: SymptomCategory.PHYSICAL, value: 'moderate' },
    { daysBack: 2, symptomId: 'mood-swings', category: SymptomCategory.MOOD,     value: 'present' },
  ])
  await seedPred(proSelf.id, daysAgo(8), 28)
  await seedNotifPref(proSelf.id)

  // Profile B: WIFE
  const proWife = await prisma.profile.upsert({
    where: { id: `seed-dummy-pro-wife-${proUser.id}` },
    update: {},
    create: {
      id: `seed-dummy-pro-wife-${proUser.id}`,
      userId: proUser.id,
      name: 'Prity (Wife)',
      relation: ProfileRelation.WIFE,
      cycleLength: 30,
      periodLength: 4,
      lastPeriodStart: daysAgo(12),
      goal: 'tracking',
    },
  })
  await seedPeriodLogs(proWife.id, [
    { idx: 1, startDaysAgo: 72, durationDays: 4, flow: FlowIntensity.LIGHT },
    { idx: 2, startDaysAgo: 42, durationDays: 4, flow: FlowIntensity.MEDIUM },
    { idx: 3, startDaysAgo: 12, durationDays: 4, flow: FlowIntensity.LIGHT },
  ])
  await seedSymptomLogs(proWife.id, [
    { daysBack: 0, symptomId: 'all_good',  category: SymptomCategory.MOOD, value: 'all_good' },
    { daysBack: 1, symptomId: 'energetic', category: SymptomCategory.MOOD, value: 'present' },
  ])
  await seedPred(proWife.id, daysAgo(12), 30)
  await seedNotifPref(proWife.id)

  // Profile C: DAUGHTER
  const proDaughter = await prisma.profile.upsert({
    where: { id: `seed-dummy-pro-daughter-${proUser.id}` },
    update: {},
    create: {
      id: `seed-dummy-pro-daughter-${proUser.id}`,
      userId: proUser.id,
      name: 'Sadia (Daughter)',
      relation: ProfileRelation.DAUGHTER,
      cycleLength: 31,
      periodLength: 6,
      lastPeriodStart: daysAgo(20),
      goal: 'tracking',
    },
  })
  await seedPeriodLogs(proDaughter.id, [
    { idx: 1, startDaysAgo: 51, durationDays: 6, flow: FlowIntensity.HEAVY },
    { idx: 2, startDaysAgo: 20, durationDays: 6, flow: FlowIntensity.MEDIUM },
  ])
  await seedSymptomLogs(proDaughter.id, [
    { daysBack: 3, symptomId: 'fatigue',  category: SymptomCategory.PHYSICAL, value: 'high' },
    { daysBack: 4, symptomId: 'backache', category: SymptomCategory.PHYSICAL, value: 'mild' },
  ])
  await seedPred(proDaughter.id, daysAgo(20), 31)
  await seedNotifPref(proDaughter.id)

  console.log('  [dummy] 7. Pro Multi-Profile User (3 profiles, PRO): +8801700000007')
  console.log('  [dummy] Done — 8 dummy engagement users seeded.')
}

async function main() {
  console.log('Seeding database…')

  // ── Demo User ──────────────────────────────────────────────────────────────
  const demoUser = await prisma.user.upsert({
    where: { phone: '+8801712345678' },
    update: {},
    create: {
      phone: '+8801712345678',
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

  // ── Period Logs for wife profile (last 2 months) ────────────────────────────
  const wifeLogSeeds = [
    {
      id: `seed-period-log-1-${wifeProfile.id}`,
      profileId: wifeProfile.id,
      startDate: subMonths(today, 2),
      endDate: addDays(subMonths(today, 2), 4),
      flowIntensity: FlowIntensity.MEDIUM,
    },
    {
      id: `seed-period-log-2-${wifeProfile.id}`,
      profileId: wifeProfile.id,
      startDate: subMonths(today, 1),
      endDate: addDays(subMonths(today, 1), 4),
      flowIntensity: FlowIntensity.MEDIUM,
    },
  ]

  await prisma.$transaction(
    wifeLogSeeds.map((log) =>
      prisma.periodLog.upsert({
        where: { id: log.id },
        update: {},
        create: log,
      }),
    ),
  )

  console.log(`Wife period logs upserted: ${wifeLogSeeds.length}`)

  // ── Predictions (Tier 1 / AVERAGE) for both profiles ──────────────────────
  function seedPrediction(profileId: string, lastPeriodStart: Date, cycleLength: number) {
    const nextPeriodStart = addDays(lastPeriodStart, cycleLength)
    const ovulationDay = addDays(nextPeriodStart, -14)
    const fertileStart = addDays(ovulationDay, -5)
    const fertileEnd = addDays(ovulationDay, 1)

    return prisma.prediction.upsert({
      where: { profileId },
      update: {
        tier: PredictionTier.AVERAGE,
        nextPeriodStart,
        ovulationDay,
        fertileStart,
        fertileEnd,
        confidence: 0.75,
      },
      create: {
        profileId,
        tier: PredictionTier.AVERAGE,
        nextPeriodStart,
        ovulationDay,
        fertileStart,
        fertileEnd,
        confidence: 0.75,
      },
    })
  }

  await Promise.all([
    seedPrediction(selfProfile.id, subMonths(today, 1), selfProfile.cycleLength),
    seedPrediction(wifeProfile.id, subMonths(today, 1), wifeProfile.cycleLength),
  ])

  console.log('Predictions upserted for both profiles')

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

  // ── Admin User ──────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12)

  const adminUser = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: 'ADMIN', passwordHash },
    create: {
      email: ADMIN_EMAIL,
      fullName: 'Super Admin',
      authMethod: AuthMethod.EMAIL,
      role: 'ADMIN',
      passwordHash,
      profileCompleted: true,
    },
  })

  console.log(`Admin user upserted: ${adminUser.email} (id: ${adminUser.id})`)
  console.log(`  Login at http://localhost:3001/login`)
  console.log(`  Email: ${ADMIN_EMAIL}`)
  console.log(`  Password: ${ADMIN_PASSWORD}`)

  // ── Dummy test users for engagement/streak feature ─────────────────────────
  await seedDummyUsers()

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
