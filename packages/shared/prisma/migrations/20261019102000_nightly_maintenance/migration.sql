-- CreateTable
CREATE TABLE "PredictionAccuracySnapshot" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "tier" TEXT NOT NULL,
    "maeDays" DOUBLE PRECISION,
    "sampleSize" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PredictionAccuracySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PredictionAccuracySnapshot_date_tier_key" ON "PredictionAccuracySnapshot"("date", "tier");
