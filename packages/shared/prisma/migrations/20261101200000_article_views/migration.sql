-- Article views per Bangladesh day (spec #193, ticket #216).

-- CreateTable
CREATE TABLE "ArticleView" (
    "articleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,

    CONSTRAINT "ArticleView_pkey" PRIMARY KEY ("articleId","userId","day")
);

-- CreateIndex
CREATE INDEX "ArticleView_day_idx" ON "ArticleView"("day");

-- CreateIndex
CREATE INDEX "ArticleView_articleId_day_idx" ON "ArticleView"("articleId", "day");

-- AddForeignKey
ALTER TABLE "ArticleView" ADD CONSTRAINT "ArticleView_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleView" ADD CONSTRAINT "ArticleView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
