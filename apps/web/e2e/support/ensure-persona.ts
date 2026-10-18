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
 * Idempotent setup for the dashboard-mode personas (+8801700000781..783 only): onboarding done and one
 * SELF profile each. `pregnant` and `menopause` have a period 20 days ago; `firstRun` has none, so its
 * dashboard asks for the first period. Never touches any other user.
 */
export async function ensureModePersonas(): Promise<void> {
  loadEnvLocal()
  const { prisma } = await import('@vesta/shared')
  const setups = [
    { phone: PERSONAS.pregnant.phone, name: 'E2E Pregnant', goal: 'pregnancy', periodDaysAgo: 20 },
    { phone: PERSONAS.menopause.phone, name: 'E2E Menopause', goal: 'perimenopause', periodDaysAgo: 20 },
    { phone: PERSONAS.firstRun.phone, name: 'E2E First Run', goal: 'tracking', periodDaysAgo: null },
  ] as const
  for (const p of setups) {
    if (!/^0170000078[1-3]$/.test(p.phone)) throw new Error(`ensureModePersonas only manages 01700000781-783, not ${p.phone}`)
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
  }
}
