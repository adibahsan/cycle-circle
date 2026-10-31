-- Admin-set Pro price with history (ADR 0011, spec #191, ticket #202).

-- CreateEnum
CREATE TYPE "ProPricePeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "ProPrice" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "period" "ProPricePeriod" NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProPrice_effectiveFrom_createdAt_idx" ON "ProPrice"("effectiveFrom", "createdAt");

-- AddForeignKey
ALTER TABLE "ProPrice" ADD CONSTRAINT "ProPrice_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- First entry, confirmed by the owner on 2026-11-01: BDApps charges 5 taka per day. Effective from
-- an early day so every Bangladesh day has a price in effect.
INSERT INTO "ProPrice" ("id", "amount", "period", "effectiveFrom")
VALUES ('proprice_initial', 5.00, 'DAILY', '2000-01-01');
