/**
 * Idempotent setup for the `fresh` e2e persona (+8801700000777 only): onboarding done, one SELF
 * profile with a period 10 days ago (re-dated on every run so it never goes late), nothing logged today, so the dashboard check-in is available.
 * Never touches the seed user or +8801700000099. Check-ins must not be saved by tests.
 */
import fs from 'node:fs'
import path from 'node:path'
import { PERSONAS } from './personas'

function loadEnvLocal() {
  const file = path.resolve(__dirname, '../../.env.local')
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}

const DAY = 86_400_000

export async function ensureFreshPersona(): Promise<void> {
  const digits = PERSONAS.fresh.phone
  if (digits !== '01700000777') throw new Error('ensureFreshPersona only manages 01700000777')
  loadEnvLocal()
  const { prisma } = await import('@vesta/shared')
  const phone = '+88' + digits
  const user = await prisma.user.findUnique({ where: { phone } })
  if (!user) throw new Error('fresh persona user missing: dev-login must run first')
  await prisma.user.update({
    where: { id: user.id },
    data: { onboardingTourCompletedAt: user.onboardingTourCompletedAt ?? new Date(), profileCompleted: true, fullName: user.fullName ?? 'E2E Fresh' },
  })
  let profile = await prisma.profile.findFirst({ where: { userId: user.id } })
  const lastPeriodStart = new Date(Date.now() - 10 * DAY)
  if (!profile) {
    profile = await prisma.profile.create({
      data: { userId: user.id, name: 'E2E Fresh', relation: 'SELF', goal: 'tracking', cycleLength: 28, periodLength: 5, lastPeriodStart },
    })
  }
  // Keep the log recent on EVERY run (this persona only): otherwise a long-lived DB makes the persona "late".
  const recent = await prisma.periodLog.findFirst({ where: { profileId: profile.id }, orderBy: { startDate: 'desc' } })
  const endDate = new Date(lastPeriodStart.getTime() + 4 * DAY)
  if (!recent) {
    await prisma.periodLog.create({ data: { profileId: profile.id, startDate: lastPeriodStart, endDate, flowIntensity: 'MEDIUM' } })
  } else {
    await prisma.periodLog.update({ where: { id: recent.id }, data: { startDate: lastPeriodStart, endDate } })
  }
  await prisma.profile.update({ where: { id: profile.id }, data: { lastPeriodStart } })
}

/**
 * Idempotent setup for the dashboard-mode personas (+8801700000781..783 and 785 only): onboarding done and one
 * SELF profile each. `pregnant` and `menopause` have a period 20 days ago; `firstRun` has none, so its
 * dashboard asks for the first period; `late` had one 35 days ago on a 28-day cycle with no stored
 * prediction, so it is exactly 7 days late. `menopause` has three recent symptom logs (its symptom pattern).
 * Never touches any other user.
 */
export async function ensureModePersonas(): Promise<void> {
  loadEnvLocal()
  const { prisma } = await import('@vesta/shared')
  const setups = [
    { phone: PERSONAS.pregnant.phone, name: 'E2E Pregnant', goal: 'pregnancy', periodDaysAgo: 20 },
    { phone: PERSONAS.menopause.phone, name: 'E2E Menopause', goal: 'perimenopause', periodDaysAgo: 20 },
    { phone: PERSONAS.firstRun.phone, name: 'E2E First Run', goal: 'tracking', periodDaysAgo: null },
    { phone: PERSONAS.late.phone, name: 'E2E Late', goal: 'tracking', periodDaysAgo: 35 },
  ] as const
  for (const p of setups) {
    if (!/^0170000078[1235]$/.test(p.phone)) throw new Error(`ensureModePersonas only manages 01700000781-783 and 785, not ${p.phone}`)
    const user = await prisma.user.findUnique({ where: { phone: '+88' + p.phone } })
    if (!user) throw new Error(`${p.name} persona user missing: dev-login must run first`)
    await prisma.user.update({
      where: { id: user.id },
      data: { onboardingTourCompletedAt: user.onboardingTourCompletedAt ?? new Date(), profileCompleted: true, fullName: user.fullName ?? p.name },
    })
    const lastPeriodStart = p.periodDaysAgo == null ? null : new Date(Date.now() - p.periodDaysAgo * DAY)
    let profile = await prisma.profile.findFirst({ where: { userId: user.id } })
    if (!profile) {
      profile = await prisma.profile.create({
        data: { userId: user.id, name: p.name, relation: 'SELF', goal: p.goal, cycleLength: 28, periodLength: 5, lastPeriodStart },
      })
    }
    // Re-assert the state on every run: the goal and (for firstRun) no period at all.
    await prisma.profile.update({ where: { id: profile.id }, data: { goal: p.goal, lastPeriodStart } })
    if (lastPeriodStart == null) {
      await prisma.periodLog.deleteMany({ where: { profileId: profile.id } })
      await prisma.prediction.deleteMany({ where: { profileId: profile.id } })
    } else {
      const endDate = new Date(lastPeriodStart.getTime() + 4 * DAY)
      const recent = await prisma.periodLog.findFirst({ where: { profileId: profile.id }, orderBy: { startDate: 'desc' } })
      if (!recent) await prisma.periodLog.create({ data: { profileId: profile.id, startDate: lastPeriodStart, endDate, flowIntensity: 'MEDIUM' } })
      else await prisma.periodLog.update({ where: { id: recent.id }, data: { startDate: lastPeriodStart, endDate } })
    }
    // Late: the countdown comes from the period log alone, never a stale stored prediction.
    if (p.phone === PERSONAS.late.phone) {
      await prisma.periodLog.deleteMany({ where: { profileId: profile.id, startDate: { not: lastPeriodStart! } } })
      await prisma.prediction.deleteMany({ where: { profileId: profile.id } })
    }
    // Menopause: a fixed symptom pattern over the last 90 days (hot flashes twice, poor sleep once).
    if (p.phone === PERSONAS.menopause.phone) {
      await prisma.symptomLog.deleteMany({ where: { profileId: profile.id } })
      const day = (ago: number) => {
        const d = new Date(Date.now() - ago * DAY)
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
      }
      await prisma.symptomLog.createMany({
        data: [
          { profileId: profile.id, date: day(2), category: 'PHYSICAL', symptomId: 'hot-flashes', value: 'mild' },
          { profileId: profile.id, date: day(5), category: 'PHYSICAL', symptomId: 'hot-flashes', value: 'mild' },
          { profileId: profile.id, date: day(9), category: 'LIFESTYLE', symptomId: 'poor-sleep', value: 'mild' },
        ],
      })
    }
  }
}

/**
 * Idempotent setup for the `cyclesOnly` persona (+8801700000784 only): one SELF profile with exactly three
 * periods (two completed cycles, 28 and 32 days, so the cycle length line has two points) and no symptom
 * logs, so Insights shows every chart except symptom frequency. Re-dated on every run.
 */
export async function ensureInsightsPersona(): Promise<void> {
  const digits = PERSONAS.cyclesOnly.phone
  if (digits !== '01700000784') throw new Error('ensureInsightsPersona only manages 01700000784')
  loadEnvLocal()
  const { prisma } = await import('@vesta/shared')
  const user = await prisma.user.findUnique({ where: { phone: '+88' + digits } })
  if (!user) throw new Error('cyclesOnly persona user missing: dev-login must run first')
  await prisma.user.update({
    where: { id: user.id },
    data: { onboardingTourCompletedAt: user.onboardingTourCompletedAt ?? new Date(), profileCompleted: true, fullName: user.fullName ?? 'E2E Cycles Only' },
  })
  // Cycles of 28 and 32 days: unequal, so the line is not flat (a flat path has a zero-height box).
  const starts = [74, 46, 14].map((d) => new Date(Date.now() - d * DAY))
  const lastPeriodStart = starts[starts.length - 1]
  let profile = await prisma.profile.findFirst({ where: { userId: user.id } })
  if (!profile) {
    profile = await prisma.profile.create({
      data: { userId: user.id, name: 'E2E Cycles Only', relation: 'SELF', goal: 'tracking', cycleLength: 28, periodLength: 5, lastPeriodStart },
    })
  }
  await prisma.profile.update({ where: { id: profile.id }, data: { goal: 'tracking', lastPeriodStart } })
  await prisma.symptomLog.deleteMany({ where: { profileId: profile.id } })
  await prisma.periodLog.deleteMany({ where: { profileId: profile.id } })
  await prisma.periodLog.createMany({
    data: starts.map((startDate) => ({ profileId: profile.id, startDate, endDate: new Date(startDate.getTime() + 4 * DAY), flowIntensity: 'MEDIUM' as const })),
  })
}
