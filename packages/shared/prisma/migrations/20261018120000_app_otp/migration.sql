-- App OTP (ADR 0002 amendment 2026-10-18): codes we send ourselves are checked against a hash.
ALTER TABLE "OtpChallenge" ADD COLUMN "codeHash" TEXT;
ALTER TABLE "OtpChallenge" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
