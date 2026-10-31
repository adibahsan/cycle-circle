-- SMS campaigns replace broadcasts (ADR 0010, spec #190).
--   1. create SmsCampaign, SmsCampaignMessage, SystemSetting
--   2. turn every SmsBroadcast into a one-day campaign with one message
--   3. drop SmsBroadcast and its enums
-- Nothing is resent: sent, failed and in-flight rows keep a terminal status.

-- CreateEnum
CREATE TYPE "SmsMessageStatus" AS ENUM ('PLANNED', 'SENDING', 'SENT', 'FAILED', 'MISSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "SmsCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsCampaignMessage" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "body" TEXT NOT NULL,
    "status" "SmsMessageStatus" NOT NULL DEFAULT 'PLANNED',
    "sentAt" TIMESTAMP(3),
    "providerRequestId" TEXT,
    "providerMessageId" TEXT,
    "audienceSize" INTEGER,
    "deliveredCount" INTEGER,
    "failedCount" INTEGER,
    "sendAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "legacyBroadcastId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsCampaignMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "SmsCampaign_createdAt_idx" ON "SmsCampaign"("createdAt");

-- CreateIndex
CREATE INDEX "SmsCampaignMessage_day_idx" ON "SmsCampaignMessage"("day");

-- CreateIndex
CREATE INDEX "SmsCampaignMessage_status_idx" ON "SmsCampaignMessage"("status");

-- CreateIndex
CREATE INDEX "SmsCampaignMessage_providerRequestId_idx" ON "SmsCampaignMessage"("providerRequestId");

-- CreateIndex
CREATE INDEX "SmsCampaignMessage_providerMessageId_idx" ON "SmsCampaignMessage"("providerMessageId");

-- One message per Bangladesh day across all campaigns (Prisma cannot express a partial index).
CREATE UNIQUE INDEX "SmsCampaignMessage_one_active_per_day" ON "SmsCampaignMessage"("day") WHERE status IN ('PLANNED', 'SENDING');

-- AddForeignKey
ALTER TABLE "SmsCampaign" ADD CONSTRAINT "SmsCampaign_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsCampaignMessage" ADD CONSTRAINT "SmsCampaignMessage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SmsCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Legacy data: compose the body the way composeSms did (EN -> message, BN -> messageBn, BOTH ->
-- message + newline + messageBn when messageBn is not blank), take the Bangladesh day of
-- scheduledFor, else sentAt, else createdAt (timestamps are stored as UTC), and map the status.
-- An unscheduled DRAFT never goes out by itself, so it is MISSED rather than PLANNED.
CREATE TEMP TABLE "_legacy_sms" AS
SELECT
    b."id" AS "legacyId",
    b."createdBy",
    b."createdAt",
    b."updatedAt",
    b."sentAt",
    b."providerMessageId",
    b."targetCount",
    b."deliveredCount",
    b."failedCount",
    b."sendAttempts",
    CASE WHEN b."status" = 'SENDING' THEN 'Outcome unknown (migrated while sending)' ELSE b."lastError" END AS "lastError",
    CASE b."sendLanguage"
        WHEN 'EN' THEN b."message"
        WHEN 'BN' THEN COALESCE(NULLIF(btrim(b."messageBn"), ''), b."message")
        ELSE CASE WHEN b."messageBn" IS NOT NULL AND btrim(b."messageBn") <> ''
                  THEN b."message" || E'\n' || b."messageBn"
                  ELSE b."message" END
    END AS "body",
    ((COALESCE(b."scheduledFor", b."sentAt", b."createdAt") AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka')::date AS "day",
    CASE
        WHEN b."status" = 'SENT' THEN 'SENT'
        WHEN b."status" IN ('FAILED', 'SENDING') THEN 'FAILED'
        WHEN b."scheduledFor" IS NULL THEN 'MISSED'
        WHEN ((b."scheduledFor" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka')::date >= (now() AT TIME ZONE 'Asia/Dhaka')::date THEN 'PLANNED'
        ELSE 'MISSED'
    END AS "status"
FROM "SmsBroadcast" b;

-- Two PLANNED rows on one day: keep the earliest-created, cancel the rest.
UPDATE "_legacy_sms" l
SET "status" = 'CANCELLED'
FROM (
    SELECT "legacyId", row_number() OVER (PARTITION BY "day" ORDER BY "createdAt", "legacyId") AS rn
    FROM "_legacy_sms"
    WHERE "status" = 'PLANNED'
) d
WHERE l."legacyId" = d."legacyId" AND d.rn > 1;

INSERT INTO "SmsCampaign" ("id", "name", "createdBy", "cancelledAt", "createdAt", "updatedAt")
SELECT
    'legacy-' || l."legacyId",
    btrim(regexp_replace(left(l."body", 40), '\s+', ' ', 'g')) || ' ' || to_char(l."day", 'YYYY-MM-DD'),
    l."createdBy",
    CASE WHEN l."status" = 'CANCELLED' THEN now() END,
    l."createdAt",
    l."updatedAt"
FROM "_legacy_sms" l;

INSERT INTO "SmsCampaignMessage" (
    "id", "campaignId", "day", "body", "status", "sentAt", "providerMessageId", "audienceSize",
    "deliveredCount", "failedCount", "sendAttempts", "lastError", "legacyBroadcastId", "createdAt", "updatedAt"
)
SELECT
    'legacy-msg-' || l."legacyId",
    'legacy-' || l."legacyId",
    l."day",
    l."body",
    l."status"::"SmsMessageStatus",
    l."sentAt",
    l."providerMessageId",
    l."targetCount",
    l."deliveredCount",
    l."failedCount",
    l."sendAttempts",
    l."lastError",
    l."legacyId",
    l."createdAt",
    l."updatedAt"
FROM "_legacy_sms" l;

DROP TABLE "_legacy_sms";

-- DropTable
DROP TABLE "SmsBroadcast";

-- DropEnum
DROP TYPE "SmsBroadcastStatus";

-- DropEnum
DROP TYPE "SmsSendLanguage";
