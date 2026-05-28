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

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "fullName" TEXT,
    "authMethod" "AuthMethod" NOT NULL,
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'FREE',
    "language" "Language" NOT NULL DEFAULT 'EN',
    "emailTrialExpiresAt" TIMESTAMP(3),
    "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "role" "Role" NOT NULL DEFAULT 'USER',
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaasTransaction" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
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

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

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
