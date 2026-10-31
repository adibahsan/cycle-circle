import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { testPrisma } from '../helpers/test-db'

// Runs the real 20261101120000_sms_campaigns migration inside a rolled-back transaction, against
// a scratch schema holding the OLD SmsBroadcast shape, and checks how legacy rows come out.

const MIGRATION = resolve(__dirname, '../../../../packages/shared/prisma/migrations/20261101120000_sms_campaigns/migration.sql')

function statements(sql: string) {
  return sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean)
}

const ROLLBACK = 'rollback-sentinel'

type Out = {
  messages: Record<string, Record<string, unknown>>
  campaigns: Record<string, Record<string, unknown>>
  oldTableGone: boolean
  duplicateActiveDayRejected: boolean
}

async function runMigration(): Promise<Out> {
  let out: Out | undefined
  await testPrisma
    .$transaction(
      async (tx) => {
        const x = (sql: string) => tx.$executeRawUnsafe(sql)
        await x('CREATE SCHEMA mig196')
        await x('SET LOCAL search_path TO mig196')
        await x('CREATE TABLE "User" ("id" TEXT PRIMARY KEY)')
        await x(`INSERT INTO "User" ("id") VALUES ('u1')`)
        await x(`CREATE TYPE "SmsBroadcastStatus" AS ENUM ('DRAFT','SCHEDULED','SENDING','SENT','FAILED')`)
        await x(`CREATE TYPE "SmsSendLanguage" AS ENUM ('BN','EN','BOTH')`)
        await x(`CREATE TABLE "SmsBroadcast" (
          "id" TEXT PRIMARY KEY, "message" TEXT NOT NULL, "messageBn" TEXT,
          "sendLanguage" "SmsSendLanguage" NOT NULL DEFAULT 'BOTH',
          "scheduledFor" TIMESTAMP(3), "sentAt" TIMESTAMP(3),
          "status" "SmsBroadcastStatus" NOT NULL DEFAULT 'DRAFT', "active" BOOLEAN NOT NULL DEFAULT true,
          "providerMessageId" TEXT, "targetCount" INTEGER, "deliveredCount" INTEGER, "failedCount" INTEGER,
          "sendAttempts" INTEGER NOT NULL DEFAULT 0, "lastError" TEXT, "createdBy" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`)

        const today = `(now() AT TIME ZONE 'Asia/Dhaka')::date`
        // Each row: id, message, messageBn, lang, scheduledFor, sentAt, status, providerMessageId,
        // targetCount, deliveredCount, failedCount, sendAttempts, lastError, createdAt (SQL literals).
        const rows: string[] = [
          // SENT: counters and provider id carry over; scheduledFor 20:00Z is already the next Dhaka day
          `'b-sent','Hello world',NULL,'EN','2020-03-10 20:00','2020-03-10 20:05','SENT','m1',5,3,1,1,NULL,'2020-03-01'`,
          `'b-failed','English text','বাংলা পাঠ','BN','2020-04-01 08:00',NULL,'FAILED',NULL,NULL,NULL,NULL,3,'boom','2020-03-02'`,
          `'b-sending','En','বাংলা','BOTH','2020-05-01 08:00',NULL,'SENDING',NULL,NULL,NULL,NULL,0,NULL,'2020-03-03'`,
          // two PLANNED on one future day: the earlier-created wins; BOTH with a blank Bengali text is English only
          `'b-plan-a','Plan A','   ','BOTH',(${today} + 3)::timestamp + interval '2 hours',NULL,'SCHEDULED',NULL,NULL,NULL,NULL,0,NULL,'2020-03-04'`,
          `'b-plan-b','Plan B','বি','BOTH',(${today} + 3)::timestamp + interval '4 hours',NULL,'DRAFT',NULL,NULL,NULL,NULL,0,NULL,'2020-03-05'`,
          `'b-past','Past schedule',NULL,'EN','2020-06-01 08:00',NULL,'SCHEDULED',NULL,NULL,NULL,NULL,0,NULL,'2020-03-06'`,
          `'b-draft','Never scheduled',NULL,'EN',NULL,NULL,'DRAFT',NULL,NULL,NULL,NULL,0,NULL,'2020-03-07'`,
          `'b-today','Today',NULL,'EN',now() AT TIME ZONE 'UTC',NULL,'SCHEDULED',NULL,NULL,NULL,NULL,0,NULL,'2020-03-08'`,
          `'b-long','${'x'.repeat(30)} ${'y'.repeat(30)}',NULL,'EN','2020-07-01 08:00','2020-07-01 08:01','SENT',NULL,0,0,0,1,NULL,'2020-03-09'`,
          // sent with no scheduledFor: the day comes from sentAt
          `'b-sentonly','Sent by hand',NULL,'EN',NULL,'2020-08-01 19:00','SENT',NULL,0,0,0,1,NULL,'2020-03-10'`,
        ]
        for (const r of rows) {
          await x(`INSERT INTO "SmsBroadcast"
            ("id","message","messageBn","sendLanguage","scheduledFor","sentAt","status","providerMessageId","targetCount","deliveredCount","failedCount","sendAttempts","lastError","createdAt","createdBy")
            VALUES (${r},'u1')`)
        }

        for (const s of statements(readFileSync(MIGRATION, 'utf8'))) await x(s)

        const rowsOf = async (table: string, key: string) => {
          const r = (await tx.$queryRawUnsafe(`SELECT * FROM "${table}"`)) as Record<string, unknown>[]
          return Object.fromEntries(r.map((row) => [String(row[key]), row]))
        }
        const messages = await rowsOf('SmsCampaignMessage', 'legacyBroadcastId')
        const campaigns = await rowsOf('SmsCampaign', 'id')
        const gone = (await tx.$queryRawUnsafe(
          `SELECT to_regclass('mig196."SmsBroadcast"') IS NULL AS gone`,
        )) as { gone: boolean }[]

        let rejected = false
        await x('SAVEPOINT dup')
        try {
          await x(`INSERT INTO "SmsCampaign" ("id","name","createdBy","updatedAt") VALUES ('c-dup','dup','u1',now())`)
          const ins = (id: string) =>
            x(`INSERT INTO "SmsCampaignMessage" ("id","campaignId","day","body","updatedAt") VALUES ('${id}','c-dup','2031-01-01','x',now())`)
          await ins('m-dup-1')
          await ins('m-dup-2')
        } catch {
          rejected = true
          await x('ROLLBACK TO SAVEPOINT dup')
        }

        out = { messages, campaigns, oldTableGone: gone[0].gone, duplicateActiveDayRejected: rejected }
        throw new Error(ROLLBACK)
      },
      { timeout: 60_000 },
    )
    .catch((e: Error) => {
      if (e.message !== ROLLBACK) throw e
    })
  return out!
}

describe('legacy SmsBroadcast -> campaign migration', () => {
  it('maps status, day, body and counters, dedupes PLANNED clashes, and drops the old table', async () => {
    const o = await runMigration()
    const m = (id: string) => o.messages[id]
    const day = (id: string) => new Date(m(id).day as Date).toISOString().slice(0, 10)

    expect(Object.keys(o.messages)).toHaveLength(10)
    expect(o.oldTableGone).toBe(true)

    // SENT: terminal, counters + provider id copied, targetCount -> audienceSize, never PLANNED again
    expect(m('b-sent')).toMatchObject({
      status: 'SENT', body: 'Hello world', providerMessageId: 'm1', providerRequestId: null,
      audienceSize: 5, deliveredCount: 3, failedCount: 1, sendAttempts: 1, campaignId: 'legacy-b-sent',
    })
    expect(day('b-sent')).toBe('2020-03-11') // 20:00Z is already the next Bangladesh day
    expect(new Date(m('b-sent').sentAt as Date).toISOString()).toBe('2020-03-10T20:05:00.000Z')

    // BN sends only the Bengali text; FAILED stays FAILED with its error
    expect(m('b-failed')).toMatchObject({ status: 'FAILED', body: 'বাংলা পাঠ', lastError: 'boom', sendAttempts: 3 })

    // SENDING cannot be known: FAILED with an explicit error, BOTH is "en\nbn"
    expect(m('b-sending')).toMatchObject({
      status: 'FAILED', body: 'En\nবাংলা', lastError: 'Outcome unknown (migrated while sending)',
    })

    // PLANNED clash: earliest created wins, the other is CANCELLED and its campaign cancelled too
    expect(m('b-plan-a')).toMatchObject({ status: 'PLANNED', body: 'Plan A' }) // blank Bengali ignored
    expect(m('b-plan-b')).toMatchObject({ status: 'CANCELLED', body: 'Plan B\nবি' })
    expect(day('b-plan-a')).toBe(day('b-plan-b'))
    expect(o.campaigns['legacy-b-plan-a'].cancelledAt).toBeNull()
    expect(o.campaigns['legacy-b-plan-b'].cancelledAt).not.toBeNull()

    // Past schedule and unscheduled drafts never go out by themselves
    expect(m('b-past').status).toBe('MISSED')
    expect(m('b-draft').status).toBe('MISSED')
    // Scheduled for today (Bangladesh) stays PLANNED
    expect(m('b-today').status).toBe('PLANNED')
    // No scheduledFor: the day falls back to sentAt (19:00Z = next Dhaka day)
    expect(day('b-sentonly')).toBe('2020-08-02')

    // Campaign: name is the first 40 chars of the body plus the Bangladesh day, createdBy copied
    expect(o.campaigns['legacy-b-long'].name).toBe(`${'x'.repeat(30)} ${'y'.repeat(9)} 2020-07-01`)
    expect(o.campaigns['legacy-b-sent']).toMatchObject({ name: 'Hello world 2020-03-11', createdBy: 'u1' })
    expect(new Date(o.campaigns['legacy-b-sent'].createdAt as Date).toISOString().slice(0, 10)).toBe('2020-03-01')

    // The one-message-per-day index is live
    expect(o.duplicateActiveDayRejected).toBe(true)
  })
})
