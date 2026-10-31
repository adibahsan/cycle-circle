// Client-safe SMS helpers (no DB / server imports) — shared by the sms-service and the admin UI.

export type SmsSendLanguage = 'BN' | 'EN' | 'BOTH'

/** One campaign line, produced by both the line parser and the CSV parser. */
export interface SmsDraft {
  messageEn: string
  messageBn?: string
  /** YYYY-MM-DD (or ISO datetime); absent = fill from the start date */
  scheduledDate?: string
}

// ── Status guards ──────────────────────────────────────────────────────────────

/** What an admin may do with a campaign message in each status; the services guard and the UI both use these. */
export const canEditMessage = (status: string) => status === 'PLANNED' || status === 'FAILED'
export const canSendMessage = (status: string) => status === 'PLANNED'
/** A campaign can be deleted while none of its messages has gone out (or is going out). */
export const canDeleteCampaign = (messages: { status: string }[]) =>
  messages.every((m) => m.status !== 'SENT' && m.status !== 'SENDING')

// ── Composition ────────────────────────────────────────────────────────────────

export function combineBilingualSms(messageEn: string, messageBn?: string | null): string {
  return messageBn && messageBn.trim() ? `${messageEn}\n${messageBn}` : messageEn
}

/** Build the text handsets receive for the chosen send language. */
export function composeSms(
  messageEn: string,
  messageBn: string | null | undefined,
  language: SmsSendLanguage,
): string {
  if (language === 'EN') return messageEn
  if (language === 'BN') {
    if (!messageBn || !messageBn.trim()) throw new Error('A Bengali message is required to send in Bengali')
    return messageBn
  }
  return combineBilingualSms(messageEn, messageBn)
}

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

// ── Line parser ────────────────────────────────────────────────────────────────

/** One message per non-empty line; optional Bengali after '|': "English | Bengali". */
export function parseBulkSmsInput(text: string): SmsDraft[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((line) => {
      const [en, bn] = line.split('|').map((s) => s.trim())
      return bn ? { messageEn: en, messageBn: bn } : { messageEn: en }
    })
    .filter((r) => r.messageEn.length > 0)
}

// ── CSV parser ─────────────────────────────────────────────────────────────────

export const SMS_CSV_TEMPLATE =
  'scheduled_date,message_en,message_bn\n' +
  '2026-11-01,"Drink water today, stay hydrated.",আজ পর্যাপ্ত পানি পান করুন।\n' +
  ',English only message with no fixed date,\n'

export interface SmsCsvError {
  line: number
  message: string
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

const DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})?)?$/

/** Parse a CSV (header: scheduled_date, message_en, message_bn) into drafts + per-line errors. */
export function parseSmsCsv(text: string): { drafts: SmsDraft[]; errors: SmsCsvError[] } {
  const records = splitCsvRecords(text)
  const drafts: SmsDraft[] = []
  const errors: SmsCsvError[] = []
  const header = records.shift()
  if (!header) return { drafts, errors: [{ line: 1, message: 'The file is empty' }] }
  const cols = header.fields.map((h) => h.trim().toLowerCase())
  const iEn = cols.indexOf('message_en')
  const iBn = cols.indexOf('message_bn')
  const iDate = cols.indexOf('scheduled_date')
  if (iEn < 0) return { drafts, errors: [{ line: 1, message: 'Missing "message_en" column in the header' }] }

  for (const rec of records) {
    const cell = (i: number) => (i >= 0 ? (rec.fields[i] ?? '').trim() : '')
    const en = cell(iEn)
    const bn = cell(iBn)
    const date = cell(iDate)
    if (!en && !bn && !date) continue // blank row
    if (!en) {
      errors.push({ line: rec.line, message: 'message_en is required' })
      continue
    }
    if (date && (!DATE_RE.test(date) || Number.isNaN(Date.parse(date)))) {
      errors.push({ line: rec.line, message: `Invalid date "${date}" (use YYYY-MM-DD)` })
      continue
    }
    const draft: SmsDraft = { messageEn: en }
    if (bn) draft.messageBn = bn
    if (date) draft.scheduledDate = date
    drafts.push(draft)
  }
  return { drafts, errors }
}

// ── Scheduling ─────────────────────────────────────────────────────────────────

/**
 * Send time per draft. Dated drafts go out on their date at 08:00 UTC (date-only) ;
 * undated drafts take consecutive days from startDate (default tomorrow), in order.
 */
export function scheduleDrafts(drafts: SmsDraft[], startDate?: string, now: Date = new Date()): Date[] {
  const base = startDate ? new Date(startDate) : new Date(now)
  if (!startDate) base.setUTCDate(base.getUTCDate() + 1)
  base.setUTCHours(8, 0, 0, 0)
  let undated = 0
  return drafts.map((d) => {
    if (d.scheduledDate) {
      const when = new Date(d.scheduledDate)
      if (/^\d{4}-\d{2}-\d{2}$/.test(d.scheduledDate)) when.setUTCHours(8, 0, 0, 0)
      return when
    }
    const when = new Date(base)
    when.setUTCDate(base.getUTCDate() + undated++)
    return when
  })
}
