-- CreateTable
CREATE TABLE "CronSetting" (
    "slug" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "CronSetting_pkey" PRIMARY KEY ("slug")
);
