-- AlterTable
ALTER TABLE "ArticleCategory" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill: keep today's alphabetical order as the starting admin order.
UPDATE "ArticleCategory" c
SET "sortOrder" = s.rn
FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY name) AS rn FROM "ArticleCategory") s
WHERE c.id = s.id;

-- CreateIndex
CREATE INDEX "ArticleCategory_sortOrder_idx" ON "ArticleCategory"("sortOrder");
