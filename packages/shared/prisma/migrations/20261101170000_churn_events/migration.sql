-- CreateEnum
CREATE TYPE "ChurnReason" AS ENUM ('DAILY_CHECK', 'BDAPPS_UNSUBSCRIBE', 'ADMIN_REVOKE', 'ACCOUNT_DELETED');

-- CreateTable
CREATE TABLE "ChurnEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "reason" "ChurnReason" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChurnEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChurnEvent_occurredAt_idx" ON "ChurnEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "ChurnEvent_userId_idx" ON "ChurnEvent"("userId");

-- AddForeignKey
ALTER TABLE "ChurnEvent" ADD CONSTRAINT "ChurnEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
