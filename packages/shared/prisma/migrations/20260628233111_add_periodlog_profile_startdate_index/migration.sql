-- DropIndex
DROP INDEX "PeriodLog_profileId_idx";

-- CreateIndex
CREATE INDEX "PeriodLog_profileId_startDate_idx" ON "PeriodLog"("profileId", "startDate");
