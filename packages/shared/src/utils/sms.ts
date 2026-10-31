// Client-safe SMS helpers (no DB / server imports) — shared by the sms-service and the admin UI.

// ── Status guards ──────────────────────────────────────────────────────────────

/** What an admin may do with a campaign message in each status; the services guard and the UI both use these.
 * Only a PLANNED message is editable or movable; a failed or missed day is resent on a free day instead. */
export const canEditMessage = (status: string) => status === 'PLANNED'
export const canSendMessage = (status: string) => status === 'PLANNED'
/** A campaign can be deleted while none of its messages has gone out (or is going out). */
export const canDeleteCampaign = (messages: { status: string }[]) =>
  messages.every((m) => m.status !== 'SENT' && m.status !== 'SENDING')

// ── Part counter ───────────────────────────────────────────────────────────────

const GSM7_BASIC = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\u001bÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
)
const GSM7_EXT = new Set('^{}\\[~]|€\f')

export interface SmsPartCount {
  encoding: 'GSM7' | 'UCS2'
  parts: number
  charsLeft: number
}

/** GSM-7: 160 single / 153 per part. UCS-2 (Bengali etc.): 70 / 67. */
export function countSmsParts(text: string): SmsPartCount {
  let septets = 0
  let gsm = true
  for (const ch of text) {
    if (GSM7_BASIC.has(ch)) septets += 1
    else if (GSM7_EXT.has(ch)) septets += 2
    else {
      gsm = false
      break
    }
  }
  const [single, multi] = gsm ? [160, 153] : [70, 67]
  const length = gsm ? septets : text.length // UTF-16 code units
  if (length === 0) return { encoding: gsm ? 'GSM7' : 'UCS2', parts: 0, charsLeft: single }
  if (length <= single) return { encoding: gsm ? 'GSM7' : 'UCS2', parts: 1, charsLeft: single - length }
  const parts = Math.ceil(length / multi)
  return { encoding: gsm ? 'GSM7' : 'UCS2', parts, charsLeft: parts * multi - length }
}

/** Admin warns above this many parts. */
export const SMS_PART_WARN_THRESHOLD = 2

/** Planning limits, enforced by the server and mirrored in the composer. */
export const SMS_MAX_PARTS = 6
export const SMS_MAX_CAMPAIGN_MESSAGES = 120
export const SMS_MAX_CAMPAIGN_NAME = 80

/** Why a message text cannot be planned (empty, or longer than SMS_MAX_PARTS parts); null when fine. */
export function validateSmsBody(body: string): string | null {
  if (!body.trim()) return 'Message cannot be empty'
  const { parts } = countSmsParts(body)
  if (parts > SMS_MAX_PARTS) return `Message is ${parts} SMS parts long; the limit is ${SMS_MAX_PARTS}`
  return null
}

// ── Campaign CSV parser ─────────────────────────────────────────────────────────────────

/** Why a CSV row (or the file) is refused. `line` is the 1-based line in the file (the header is line 1). */
export interface SmsCsvError {
  line: number
  message: string
}

/** The import file's size cap, enforced by the server before parsing. */
export const SMS_MAX_CSV_CHARS = 200_000

/** A downloadable example for the import: header plus two rows starting at `firstDay`. */
export function campaignCsvTemplate(firstDay: string, secondDay: string): string {
  return (
    'day,text\n' +
    `${firstDay},"Drink water today, stay hydrated."\n` +
    `${secondDay},আজ পর্যাপ্ত পানি পান করুন।\n`
  )
}

/** RFC-4180 record splitter: quoted fields, "" escapes, embedded newlines, CRLF. */
function splitCsvRecords(input: string): { fields: string[]; line: number }[] {
  const text = input.replace(/^﻿/, '')
  const records: { fields: string[]; line: number }[] = []
  let fields: string[] = []
  let field = ''
  let inQuotes = false
  let line = 1
  let startLine = 1
  const endRecord = () => {
    fields.push(field)
    records.push({ fields, line: startLine })
    fields = []
    field = ''
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else {
        if (c === '\n') line++
        field += c
      }
    } else if (c === '"') inQuotes = true
    else if (c === ',') {
      fields.push(field)
      field = ''
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++
      endRecord()
      line++
      startLine = line
    } else field += c
  }
  if (field !== '' || fields.length > 0) endRecord()
  return records
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** A real calendar day (rejects 2026-02-31, which `Date.parse` would roll over). */
function isRealDay(day: string): boolean {
  if (!DAY_RE.test(day)) return false
  const t = Date.parse(`${day}T00:00:00Z`)
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === day
}

export interface CampaignCsvRow {
  line: number
  day: string
  body: string
}

/**
 * Parse a campaign CSV (header `day,text`, columns in any order, one row per Bangladesh day) into
 * rows plus row-level errors. Checks only what the file itself shows: day format, repeated days,
 * empty or over-long text, the row cap. Past days and clashes with other campaigns need the
 * database and are checked by the server. Blank rows are skipped.
 */
export function parseCampaignCsv(text: string): { rows: CampaignCsvRow[]; errors: SmsCsvError[] } {
  const records = splitCsvRecords(text)
  const rows: CampaignCsvRow[] = []
  const errors: SmsCsvError[] = []
  const header = records.shift()
  if (!header) return { rows, errors: [{ line: 1, message: 'The file is empty' }] }
  const cols = header.fields.map((h) => h.trim().toLowerCase())
  const iDay = cols.indexOf('day')
  const iText = cols.indexOf('text')
  if (iDay < 0 || iText < 0) {
    return { rows, errors: [{ line: 1, message: 'The header must have "day" and "text" columns' }] }
  }

  const seen = new Map<string, number>()
  let count = 0
  for (const rec of records) {
    const day = (rec.fields[iDay] ?? '').trim()
    const body = (rec.fields[iText] ?? '').trim()
    if (!day && !body) continue // blank row
    count++
    if (count === SMS_MAX_CAMPAIGN_MESSAGES + 1) {
      errors.push({ line: rec.line, message: `Too many rows: a campaign can have at most ${SMS_MAX_CAMPAIGN_MESSAGES} messages` })
    }
    if (count > SMS_MAX_CAMPAIGN_MESSAGES) continue
    if (!day) {
      errors.push({ line: rec.line, message: 'day is required' })
      continue
    }
    if (!isRealDay(day)) {
      errors.push({ line: rec.line, message: `Invalid day "${day}" (use YYYY-MM-DD)` })
      continue
    }
    const first = seen.get(day)
    if (first !== undefined) {
      errors.push({ line: rec.line, message: `${day} is already used on line ${first}` })
      continue
    }
    seen.set(day, rec.line)
    const problem = validateSmsBody(body)
    if (problem) {
      errors.push({ line: rec.line, message: problem })
      continue
    }
    rows.push({ line: rec.line, day, body })
  }
  if (count === 0) errors.push({ line: 1, message: 'The file has no rows' })
  return { rows, errors }
}
