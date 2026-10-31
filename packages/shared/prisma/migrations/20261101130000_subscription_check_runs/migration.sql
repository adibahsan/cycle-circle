-- CreateEnum
CREATE TYPE "SubscriptionCheckTrigger" AS ENUM ('CRON', 'MANUAL');

-- CreateEnum
CREATE TYPE "SubscriptionCheckStatus" AS ENUM ('OK', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "SubscriptionCheckOutcomeKind" AS ENUM ('MOVED_TO_FREE', 'ERROR');

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "lastConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "lastReportedStatus" TEXT;

-- CreateTable
CREATE TABLE "SubscriptionCheckRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "trigger" "SubscriptionCheckTrigger" NOT NULL,
    "status" "SubscriptionCheckStatus" NOT NULL,
    "checkedCount" INTEGER NOT NULL DEFAULT 0,
    "movedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionCheckRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionCheckOutcome" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "maskedSubscriberId" TEXT NOT NULL,
    "outcome" "SubscriptionCheckOutcomeKind" NOT NULL,
    "bdappsStatus" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionCheckOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubscriptionCheckRun_startedAt_idx" ON "SubscriptionCheckRun"("startedAt");

-- CreateIndex
CREATE INDEX "SubscriptionCheckOutcome_runId_idx" ON "SubscriptionCheckOutcome"("runId");

-- CreateIndex
CREATE INDEX "SubscriptionCheckOutcome_userId_idx" ON "SubscriptionCheckOutcome"("userId");

-- AddForeignKey
ALTER TABLE "SubscriptionCheckOutcome" ADD CONSTRAINT "SubscriptionCheckOutcome_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SubscriptionCheckRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionCheckOutcome" ADD CONSTRAINT "SubscriptionCheckOutcome_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

