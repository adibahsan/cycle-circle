-- AlterTable
ALTER TABLE "SmsBroadcast" ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "sendAttempts" INTEGER NOT NULL DEFAULT 0;
