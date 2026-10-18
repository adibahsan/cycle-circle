-- CreateEnum
CREATE TYPE "SmsSendLanguage" AS ENUM ('BN', 'EN', 'BOTH');

-- AlterTable
ALTER TABLE "SmsBroadcast" ADD COLUMN     "sendLanguage" "SmsSendLanguage" NOT NULL DEFAULT 'BOTH';
