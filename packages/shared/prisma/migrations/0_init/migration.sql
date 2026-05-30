-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AuthMethod" AS ENUM ('OTP', 'EMAIL');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('FREE', 'PRO', 'LAPSED');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('EN', 'BN');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ProfileRelation" AS ENUM ('SELF', 'WIFE', 'SISTER', 'MOTHER', 'DAUGHTER', 'GIRLFRIEND');

-- CreateEnum
CREATE TYPE "FlowIntensity" AS ENUM ('LIGHT', 'MEDIUM', 'HEAVY');

-- CreateEnum
CREATE TYPE "SymptomCategory" AS ENUM ('PHYSICAL', 'MOOD', 'DISCHARGE', 'LIFESTYLE');

-- CreateEnum
CREATE TYPE "PredictionTier" AS ENUM ('AVERAGE', 'ARIMA', 'LSTM');

-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('BUG', 'FEATURE', 'GENERAL', 'SATISFACTION');

-- CreateEnum
CREATE TYPE "WebhookType" AS ENUM ('SMS_RECEIVE', 'SMS_REPORT', 'USSD_RECEIVE', 'SUBSCRIPTION_NOTIFY');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CyclePhase" AS ENUM ('MENSTRUAL', 'FOLLICULAR', 'OVULATION', 'LUTEAL');

-- CreateEnum
CREATE TYPE "SmsBroadcastStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('MAGIC_LINK', 'PERIOD_ALERT', 'FERTILE_ALERT', 'LOGGING_REMINDER');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailProvider" AS ENUM ('RESEND', 'SMTP');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'DELAYED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "fullName" TEXT,
    "passwordHash" TEXT,
    "authMethod" "AuthMethod" NOT NULL,
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'FREE',
    "language" "Language" NOT NULL DEFAULT 'EN',
    "emailTrialExpiresAt" TIMESTAMP(3),
    "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "suspendedAt" TIMESTAMP(3),
    "suspendedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relation" "ProfileRelation" NOT NULL,
    "cycleLength" INTEGER NOT NULL DEFAULT 28,
    "periodLength" INTEGER NOT NULL DEFAULT 5,
    "lastPeriodStart" TIMESTAMP(3),
    "goal" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodLog" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "flowIntensity" "FlowIntensity" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeriodLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SymptomLog" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" "SymptomCategory" NOT NULL,
    "symptomId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SymptomLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "tier" "PredictionTier" NOT NULL,
    "nextPeriodStart" TIMESTAMP(3) NOT NULL,
    "ovulationDay" TIMESTAMP(3) NOT NULL,
    "fertileStart" TIMESTAMP(3) NOT NULL,
    "fertileEnd" TIMESTAMP(3) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'FREE',
    "bdappsSubscriberId" TEXT,
    "paymentInstrumentName" TEXT,
    "amount" INTEGER,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "gracePeriodEndsAt" TIMESTAMP(3),
    "adminOverride" BOOLEAN NOT NULL DEFAULT false,
    "adminOverrideBy" TEXT,
    "adminOverrideAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaasTransaction" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "externalTrxId" TEXT NOT NULL,
    "internalTrxId" TEXT,
    "referenceId" TEXT,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaasTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "phone" TEXT NOT NULL,
    "referenceNo" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MagicLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "type" "WebhookType" NOT NULL,
    "payload" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "periodAlert" BOOLEAN NOT NULL DEFAULT true,
    "fertileWindow" BOOLEAN NOT NULL DEFAULT true,
    "loggingReminder" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "category" "FeedbackCategory" NOT NULL,
    "message" TEXT NOT NULL,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleBn" TEXT,
    "bodyEn" TEXT NOT NULL,
    "bodyBn" TEXT,
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "categoryId" TEXT,
    "cyclePhases" "CyclePhase"[] DEFAULT ARRAY[]::"CyclePhase"[],
    "authorId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsBroadcast" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "status" "SmsBroadcastStatus" NOT NULL DEFAULT 'DRAFT',
    "targetCount" INTEGER,
    "deliveredCount" INTEGER,
    "failedCount" INTEGER,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsBroadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "type" "EmailType" NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL,
    "error" TEXT,
    "provider" "EmailProvider" NOT NULL,
    "resendId" TEXT,
    "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "profileId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_lastLoginAt_idx" ON "User"("lastLoginAt");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE INDEX "PeriodLog_profileId_idx" ON "PeriodLog"("profileId");

-- CreateIndex
CREATE INDEX "SymptomLog_profileId_date_idx" ON "SymptomLog"("profileId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Prediction_profileId_key" ON "Prediction"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "CaasTransaction_externalTrxId_key" ON "CaasTransaction"("externalTrxId");

-- CreateIndex
CREATE INDEX "OtpChallenge_phone_idx" ON "OtpChallenge"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "MagicLink_token_key" ON "MagicLink"("token");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_idempotencyKey_key" ON "WebhookEvent"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_profileId_key" ON "NotificationPreference"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- CreateIndex
CREATE INDEX "Article_status_idx" ON "Article"("status");

-- CreateIndex
CREATE INDEX "Article_categoryId_idx" ON "Article"("categoryId");

-- CreateIndex
CREATE INDEX "Article_authorId_idx" ON "Article"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleCategory_name_key" ON "ArticleCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleCategory_slug_key" ON "ArticleCategory"("slug");

-- CreateIndex
CREATE INDEX "SmsBroadcast_status_idx" ON "SmsBroadcast"("status");

-- CreateIndex
CREATE INDEX "SmsBroadcast_scheduledFor_idx" ON "SmsBroadcast"("scheduledFor");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminId_idx" ON "AdminAuditLog"("adminId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_to_idx" ON "EmailLog"("to");

-- CreateIndex
CREATE INDEX "EmailLog_type_profileId_sentAt_idx" ON "EmailLog"("type", "profileId", "sentAt");

-- CreateIndex
CREATE INDEX "EmailLog_resendId_idx" ON "EmailLog"("resendId");

-- CreateIndex
CREATE INDEX "EmailLog_sentAt_idx" ON "EmailLog"("sentAt");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodLog" ADD CONSTRAINT "PeriodLog_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SymptomLog" ADD CONSTRAINT "SymptomLog_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaasTransaction" ADD CONSTRAINT "CaasTransaction_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtpChallenge" ADD CONSTRAINT "OtpChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicLink" ADD CONSTRAINT "MagicLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ArticleCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsBroadcast" ADD CONSTRAINT "SmsBroadcast_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

