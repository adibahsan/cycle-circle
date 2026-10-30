import { test, expect } from '../../support/fixtures'
import { newEmail, toDbPhone } from '../../support/users.ts'
import { SECRETS, URLS } from '../../support/slot.ts'
import { waitForEmail } from '../../support/mailpit.ts'
import type { BangladeshDays } from '../../support/bangladesh-day.ts'
import type { PrismaClient } from '../../support/db.ts'

/** `+8801…` / `0136…` → BDApps `tel:8801…` (same as the app's `toTelUri`). */
function toTelUri(phone: string): string {
  const db = phone.startsWith('+88') ? phone : toDbPhone(phone)
  return `tel:88${db.slice(3)}`
}

async function seedPeriodAlertProfile(
  db: PrismaClient,
  days: BangladeshDays,
  {
    userId,
    email,
    fullName,
    profileName,
    periodAlert,
  }: {
    userId: string
    email: string
    fullName: string
    profileName: string
    periodAlert: boolean
  },
) {
  await db.user.update({
    where: { id: userId },
    data: { email, fullName, profileCompleted: true },
  })
  return db.profile.create({
    data: {
      userId,
      name: profileName,
      relation: 'SELF',
      cycleLength: 28,
      periodLength: 5,
      notificationPref: {
        create: {
          periodAlert,
          fertileWindow: false,
          loggingReminder: false,
        },
      },
      predictions: {
        create: {
          tier: 'AVERAGE',
          // Due window is 0–2 days until next period.
          nextPeriodStart: days.dateOf(days.daysFromNow(1)),
          ovulationDay: days.dateOf(days.daysAgo(13)),
          fertileStart: days.dateOf(days.daysAgo(15)),
          fertileEnd: days.dateOf(days.daysAgo(11)),
          confidence: 0.6,
        },
      },
    },
  })
}

async function expectNoEmail(to: string, since: Date, waitMs = 4_000): Promise<void> {
  await new Promise((r) => setTimeout(r, waitMs))
  const listUrl = new URL('/api/v1/search', URLS.mailpit)
  listUrl.searchParams.set('query', `to:${to}`)
  listUrl.searchParams.set('limit', '20')
  const res = await fetch(listUrl)
  expect(res.ok).toBe(true)
  const data = (await res.json()) as { messages: { To?: { Address?: string }[]; Created: string }[] }
  const mine = (data.messages ?? []).filter(
    (m) =>
      (m.To?.some((t) => t.Address?.toLowerCase() === to.toLowerCase()) ?? false) &&
      new Date(m.Created) >= since,
  )
  expect(mine).toHaveLength(0)
}

async function runDailyRemindersForUser(
  request: { post: (url: string, opts: object) => Promise<{ ok: () => boolean; json: () => Promise<Record<string, unknown>> }> },
  userId: string,
) {
  const res = await request.post(`${URLS.web}/api/cron/daily-reminders`, {
    headers: { authorization: `Bearer ${SECRETS.cronSecret}` },
    data: { force: true, overrideDisabled: true, userId },
  })
  expect(res.ok()).toBe(true)
  const body = await res.json()
  expect(body.skipped).not.toBe(true)
  expect(body.errors ?? 0).toBe(0)
  return body
}

test.describe('cron: daily-reminders', () => {
  test('emails and SMSes a due user, and skips the opted-out control', async ({
    newUser,
    fakeBdapps,
    db,
    days,
    request,
  }) => {
    const due = await newUser()
    const optedOut = await newUser()
    const dueStatus = await (await due.page.request.get('/api/auth/status')).json()
    const outStatus = await (await optedOut.page.request.get('/api/auth/status')).json()
    const dueUserId = dueStatus.user.id as string
    const outUserId = outStatus.user.id as string

    const dueEmail = newEmail('cron-due')
    const outEmail = newEmail('cron-out')
    await seedPeriodAlertProfile(db, days, {
      userId: dueUserId,
      email: dueEmail,
      fullName: 'Due Reminder',
      profileName: 'DueProfile',
      periodAlert: true,
    })
    await seedPeriodAlertProfile(db, days, {
      userId: outUserId,
      email: outEmail,
      fullName: 'Opted Out',
      profileName: 'OutProfile',
      periodAlert: false,
    })

    const sinceSeq = (await fakeBdapps.calls()).at(-1)?.seq ?? 0
    const since = new Date(Date.now() - 1_000)

    // Scope to one userId per call so we never email/SMS every eligible user in the slot.
    await runDailyRemindersForUser(request, dueUserId)
    await runDailyRemindersForUser(request, outUserId)

    const mail = await waitForEmail(dueEmail, { since })
    expect(mail.subject).toMatch(/period is expected in 1 days/i)
    expect(mail.text + mail.html).toContain('DueProfile')

    await expectNoEmail(outEmail, since)

    const dueTel = toTelUri(due.phone)
    const outTel = toTelUri(optedOut.phone)
    const sms = await fakeBdapps.calls({ path: '/sms/send', sinceSeq })
    const dueSms = sms.filter((c) => {
      const addrs = c.body.destinationAddresses
      return Array.isArray(addrs) && addrs.includes(dueTel) && String(c.body.message ?? '').includes('DueProfile')
    })
    expect(dueSms.length).toBeGreaterThanOrEqual(1)
    const outSms = sms.filter((c) => {
      const addrs = c.body.destinationAddresses
      return Array.isArray(addrs) && addrs.includes(outTel) && String(c.body.message ?? '').includes('OutProfile')
    })
    expect(outSms).toHaveLength(0)
  })
})
