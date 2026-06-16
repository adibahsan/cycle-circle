-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardingTourCompletedAt" TIMESTAMP(3);

-- Backfill: mark all pre-existing accounts as tour-completed so the first-login
-- guided tour only greets genuinely new accounts created after this migration.
UPDATE "User" SET "onboardingTourCompletedAt" = now() WHERE "onboardingTourCompletedAt" IS NULL;
