import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { env } from '../../utils/env'
import { sendEmail } from '../adapters/mail'
import { addDaysToDay, bangladeshToday } from '../../utils/dhaka-date'
import { parseDateRange, rangeToParams, type DateRange } from '../../utils/date-range'
import { buildReport, type ReportKind } from '../../utils/report-builder'
import { getOverviewMetrics } from './overview-service'

// Emailed Overview reports (GLOSSARY: Bangladesh day). Settings live in SystemSetting (key/value).

export const REPORT_RECIPIENTS_KEY = 'reports.recipients'
const lastSentKey = (kind: ReportKind) => `reports.lastSent.${kind}`

// ── Recipients ───────────────────────────────────────────────────────────────

const emailSchema = z.string().email()

/** Split a pasted list on commas, semicolons, spaces and new lines; lowercase, de-duplicate, report non-emails. */
export function parseReportRecipients(input: string): { emails: string[]; invalid: string[] } {
  const emails: string[] = []
  const invalid: string[] = []
  for (const raw of input.split(/[\s,;]+/)) {
    const entry = raw.trim().toLowerCase()
    if (!entry) continue
    if (!emailSchema.safeParse(entry).success) invalid.push(raw.trim())
    else if (!emails.includes(entry)) emails.push(entry)
  }
  return { emails, invalid }
}

/** The saved recipient list. Absent or empty means no reports are sent. */
export async function getReportRecipients(): Promise<string[]> {
  const row = await prisma.systemSetting.findUnique({ where: { key: REPORT_RECIPIENTS_KEY }, select: { value: true } })
  return row?.value ? parseReportRecipients(row.value).emails : []
}

/** Save the recipient list. Throws naming the entries that are not emails, saving nothing. Returns the previous and new lists. */
export async function setReportRecipients(input: string, adminId?: string) {
  const { emails, invalid } = parseReportRecipients(input)
  if (invalid.length > 0) throw new Error(`Not a valid email address: ${invalid.join(', ')}`)
  const previous = await getReportRecipients()
  const value = emails.join(',')
  await prisma.systemSetting.upsert({
    where: { key: REPORT_RECIPIENTS_KEY },
    create: { key: REPORT_RECIPIENTS_KEY, value, updatedBy: adminId },
    update: { value, updatedBy: adminId },
  })
  return { previous, emails }
}

// ── Periods ──────────────────────────────────────────────────────────────────

/**
 * The period a report run at `now` covers, as a shared range: weekly = the previous 7 complete
 * Bangladesh days, monthly = the previous calendar month.
 */
export function reportRange(kind: ReportKind, now: Date): DateRange {
  const today = bangladeshToday(now)
  if (kind === 'weekly') {
    return parseDateRange({ from: addDaysToDay(today, -7), to: addDaysToDay(today, -1) }, now)
  }
  const firstOfThisMonth = `${today.slice(0, 7)}-01`
  const lastDay = addDaysToDay(firstOfThisMonth, -1)
  return parseDateRange({ from: `${lastDay.slice(0, 7)}-01`, to: lastDay }, now)
}

/**
 * Take the right to send this period's report; false when it was already taken.
 * The slot is a SystemSetting row holding the period key, taken with a compare-and-set,
 * so two hits at once cannot both send.
 */
async function claimPeriod(kind: ReportKind, period: string): Promise<{ previous: string | null } | null> {
  const key = lastSentKey(kind)
  const existing = await prisma.systemSetting.findUnique({ where: { key }, select: { value: true } })
  if (existing?.value === period) return null
  if (!existing) {
    try {
      await prisma.systemSetting.create({ data: { key, value: period } })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return null
      throw e
    }
    return { previous: null }
  }
  const { count } = await prisma.systemSetting.updateMany({ where: { key, value: existing.value }, data: { value: period } })
  return count === 1 ? { previous: existing.value } : null
}

async function releasePeriod(kind: ReportKind, previous: string | null) {
  const key = lastSentKey(kind)
  if (previous === null) await prisma.systemSetting.deleteMany({ where: { key } })
  else await prisma.systemSetting.updateMany({ where: { key }, data: { value: previous } })
}

export type RunReportResult = {
  kind: ReportKind
  status: 'sent' | 'no-recipients' | 'already-sent' | 'failed'
  period: string
  sent: number
  failed: number
}

/** Link to the admin Overview for `range`, or undefined when the admin URL isn't configured. */
function overviewUrl(range: DateRange): string | undefined {
  if (!env.ADMIN_APP_URL) return undefined
  return `${env.ADMIN_APP_URL.replace(/\/+$/, '')}/?${new URLSearchParams(rangeToParams(range)).toString()}`
}

/**
 * Build and email the weekly or monthly report to the saved recipients. Reads fresh data (no cache).
 * Each period is sent once: a repeated hit for the same period does nothing unless `force`.
 * One recipient failing doesn't stop the rest; if every send fails the period is released so the next hit retries.
 * Every send is logged in the email log by the mail adapter.
 */
export async function runReport(kind: ReportKind, now: Date, opts: { force?: boolean } = {}): Promise<RunReportResult> {
  const range = reportRange(kind, now)
  const base = { kind, period: range.key, sent: 0, failed: 0 }

  const recipients = await getReportRecipients()
  if (recipients.length === 0) return { ...base, status: 'no-recipients' }

  const claim = opts.force
    ? { previous: (await prisma.systemSetting.findUnique({ where: { key: lastSentKey(kind) }, select: { value: true } }))?.value ?? null }
    : await claimPeriod(kind, range.key)
  if (!claim) return { ...base, status: 'already-sent' }
  if (opts.force) {
    await prisma.systemSetting.upsert({
      where: { key: lastSentKey(kind) },
      create: { key: lastSentKey(kind), value: range.key },
      update: { value: range.key },
    })
  }

  try {
    const report = buildReport({ kind, metrics: await getOverviewMetrics(range, now), overviewUrl: overviewUrl(range) })
    let sent = 0
    let failed = 0
    for (const to of recipients) {
      try {
        await sendEmail(to, report.subject, report.html, {
          type: 'REPORT',
          text: report.text,
          attachments: [{ filename: report.csvFilename, content: report.csv, contentType: 'text/csv; charset=utf-8' }],
        })
        sent += 1
      } catch {
        failed += 1 // the mail adapter has logged the failure
      }
    }
    if (sent === 0) {
      await releasePeriod(kind, claim.previous)
      return { ...base, status: 'failed', sent, failed }
    }
    return { ...base, status: 'sent', sent, failed }
  } catch (e) {
    await releasePeriod(kind, claim.previous)
    throw e
  }
}
