-- Consolidated v1.3 migration.
-- Squashes the previously-separate `v1_3_client_review_feedback` and
-- `add_onboarding_tour_flag` migrations into one clean step on top of `0_init`.

-- AlterEnum
ALTER TYPE "EmailType" ADD VALUE 'PROFILE_COMPLETION_REMINDER';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardingTourCompletedAt" TIMESTAMP(3),
ADD COLUMN     "profileReminderOptOut" BOOLEAN NOT NULL DEFAULT false;
