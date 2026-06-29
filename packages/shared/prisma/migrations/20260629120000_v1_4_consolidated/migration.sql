-- Consolidated v1.4 migration. Squashes the four post-v1.3 migrations into one
-- clean step on top of `20260616210000_v1_3_consolidated`:
--   20260621120000_otp_users_auto_pro                    (DATA backfill)
--   20260628131041_add_sms_circulation_fields
--   20260628233111_add_periodlog_profile_startdate_index
--   20260629112337_add_cron_setting
--
-- On an already-deployed database that has the four separate migrations applied,
-- do NOT re-run this file. Reconcile history instead (see docs/releases/v1.4.0.md):
-- delete the four old rows from "_prisma_migrations" and
-- `prisma migrate resolve --applied 20260629120000_v1_4_consolidated`.

-- CreateTable
CREATE TABLE "CronSetting" (
    "slug" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "CronSetting_pkey" PRIMARY KEY ("slug")
);

-- AlterTable
ALTER TABLE "SmsBroadcast" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "messageBn" TEXT,
ADD COLUMN     "providerMessageId" TEXT;

-- CreateIndex
CREATE INDEX "SmsBroadcast_providerMessageId_idx" ON "SmsBroadcast"("providerMessageId");

-- DropIndex
DROP INDEX "PeriodLog_profileId_idx";

-- CreateIndex
CREATE INDEX "PeriodLog_profileId_startDate_idx" ON "PeriodLog"("profileId", "startDate");

-- Data backfill: OTP/phone-login users are Pro by default. Backfill existing
-- FREE OTP users that have no admin override on any subscription row. Carried by
-- hand from 20260621120000_otp_users_auto_pro (not reproducible from schema diff).
UPDATE "User" u
SET "subscriptionStatus" = 'PRO'
WHERE u."authMethod" = 'OTP'
  AND u."subscriptionStatus" = 'FREE'
  AND NOT EXISTS (
    SELECT 1 FROM "Subscription" s
    WHERE s."userId" = u."id" AND s."adminOverride" = true
  );
