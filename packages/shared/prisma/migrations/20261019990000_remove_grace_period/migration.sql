/*
  Warnings:

  - You are about to drop the column `consecutiveFailures` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `gracePeriodEndsAt` on the `Subscription` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "consecutiveFailures",
DROP COLUMN "gracePeriodEndsAt";
