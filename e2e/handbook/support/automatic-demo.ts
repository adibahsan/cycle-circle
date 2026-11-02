/**
 * Fake data for the "Automatic Behaviour" handbook chapters (#249): email log rows of every type
 * and one SMS campaign with Sent, Missed and Planned days. Idempotent (fixed ids, skipDuplicates).
 */
import type { PrismaClient } from '../../support/db.ts'
import { demoNow, demoNowMs } from './demo-clock.ts'

const DAY = 86_400_000
/** Bangladesh day `n` days from now, stored as that day at 00:00 UTC. */
const dayDateAhead = (now: Date, n: number) => new Date(`${new Date(now.getTime() + 6 * 3_600_000 + n * DAY).toISOString().slice(0, 10)}T00:00:00.000Z`)

export const DEMO_EMAIL_IDS = {
  magicLink: 'hbmail-magic',
  verification: 'hbmail-verify',
  completion: 'hbmail-completion',
  report: 'hbmail-report',
} as const

export const DEMO_CAMPAIGN_ID = 'hbsms-camp-1'

export async function seedDemoEmails(db: PrismaClient): Promise<void> {
  const now = demoNowMs()
  const rows = [
    ['hbmail-period', 'PERIOD_ALERT', 'nusrat.jahan@example.test', 'Cycle Circle: Your period is expected in 2 days', 'hbdemo-01', 'hbdemo-prof-hbdemo-01', 'DELIVERED', 1],
    ['hbmail-fertile', 'FERTILE_ALERT', 'tasnim.sultana@example.test', 'Cycle Circle: Your fertile window starts today', null, null, 'DELIVERED', 2],
    ['hbmail-logging', 'LOGGING_REMINDER', 'nusrat.jahan@example.test', "Cycle Circle: Don't forget to log your cycle", 'hbdemo-01', 'hbdemo-prof-hbdemo-01', 'PENDING', 3],
    [DEMO_EMAIL_IDS.completion, 'PROFILE_COMPLETION_REMINDER', 'sumaiya.hoque@example.test', 'Cycle Circle: Finish setting up your profile', null, null, 'DELIVERED', 4],
    [DEMO_EMAIL_IDS.magicLink, 'MAGIC_LINK', 'rahim.demo@example.test', 'Cycle Circle - Login Link', null, null, 'DELIVERED', 5],
    [DEMO_EMAIL_IDS.verification, 'VERIFICATION_CODE', 'nusrat.jahan@example.test', 'Your Cycle Circle verification code', 'hbdemo-01', null, 'DELIVERED', 6],
    [DEMO_EMAIL_IDS.report, 'REPORT', 'owner@example.test', 'Cycle Circle weekly report: 2026-10-25 to 2026-10-31', null, null, 'DELIVERED', 7],
  ] as const
  await db.emailLog.createMany({
    data: rows.map(([id, type, to, subject, userId, profileId, deliveryStatus, mins]) => ({
      id, type, to, subject, userId, profileId, status: 'SENT' as const, provider: 'RESEND' as const,
      deliveryStatus, sentAt: new Date(now - mins * 60_000),
    })),
    skipDuplicates: true,
  })
}

export async function seedDemoCampaign(db: PrismaClient): Promise<string> {
  const admin = await db.user.findFirstOrThrow({ where: { email: 'admin@vesta.health' }, select: { id: true } })
  const now = demoNow()
  await db.smsCampaign.createMany({
    data: [{ id: DEMO_CAMPAIGN_ID, name: 'Monsoon hygiene, 5 days', createdBy: admin.id }],
    skipDuplicates: true,
  })
  const text = ['Wash your hands often during the rainy season.', 'Drink boiled or filtered water.', 'Keep your sanitary products dry.', 'Change pads or cloth every 4 to 6 hours.', 'Eat fresh food and wash fruit well.']
  const plan = [
    { n: -3, status: 'SENT' as const }, { n: -2, status: 'MISSED' as const }, { n: -1, status: 'SENT' as const },
    { n: 2, status: 'PLANNED' as const }, { n: 3, status: 'PLANNED' as const },
  ]
  await db.smsCampaignMessage.createMany({
    data: plan.map((p, i) => ({
      id: `hbsms-msg-${i}`, campaignId: DEMO_CAMPAIGN_ID, day: dayDateAhead(now, p.n), body: text[i]!, status: p.status,
      sentAt: p.status === 'SENT' ? new Date(dayDateAhead(now, p.n).getTime() + 8 * 3_600_000) : null,
      audienceSize: p.status === 'SENT' ? 21 : null, lastError: p.status === 'MISSED' ? 'Missed: not sent on its day.' : null,
    })),
    skipDuplicates: true,
  })
  return DEMO_CAMPAIGN_ID
}
