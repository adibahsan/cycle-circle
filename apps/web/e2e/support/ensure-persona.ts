/**
 * Idempotent setup for the `fresh` e2e persona (+8801700000777 only): onboarding done, one SELF
 * profile with a period 10 days ago, nothing logged today, so the dashboard check-in is available.
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
  const logs = await prisma.periodLog.count({ where: { profileId: profile.id } })
  if (logs === 0) {
    await prisma.periodLog.create({
      data: { profileId: profile.id, startDate: lastPeriodStart, endDate: new Date(lastPeriodStart.getTime() + 4 * DAY), flowIntensity: 'MEDIUM' },
    })
  }
}
