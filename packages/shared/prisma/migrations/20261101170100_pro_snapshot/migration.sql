-- CreateTable
CREATE TABLE "ProSnapshot" (
    "day" DATE NOT NULL,
    "proCount" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProSnapshot_pkey" PRIMARY KEY ("day")
);
