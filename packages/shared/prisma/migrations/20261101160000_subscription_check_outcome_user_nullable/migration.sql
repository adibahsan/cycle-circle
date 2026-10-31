-- DropForeignKey
ALTER TABLE "SubscriptionCheckOutcome" DROP CONSTRAINT "SubscriptionCheckOutcome_userId_fkey";

-- AlterTable
ALTER TABLE "SubscriptionCheckOutcome" ALTER COLUMN "userId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "SubscriptionCheckOutcome" ADD CONSTRAINT "SubscriptionCheckOutcome_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

