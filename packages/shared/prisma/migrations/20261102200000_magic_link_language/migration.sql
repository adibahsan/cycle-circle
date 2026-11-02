-- The requesting page's language on a magic link (#258). Nullable: old links and
-- requests with no language choice fall back to the opening browser's cookie.

-- AlterTable
ALTER TABLE "MagicLink" ADD COLUMN "language" "Language";
