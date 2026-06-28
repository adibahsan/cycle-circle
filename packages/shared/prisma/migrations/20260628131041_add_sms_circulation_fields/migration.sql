-- AlterTable
ALTER TABLE "SmsBroadcast" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "messageBn" TEXT,
ADD COLUMN     "providerMessageId" TEXT;

-- CreateIndex
CREATE INDEX "SmsBroadcast_providerMessageId_idx" ON "SmsBroadcast"("providerMessageId");
