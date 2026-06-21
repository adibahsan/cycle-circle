-- OTP/phone-login users are Pro by default. Backfill existing FREE OTP users
-- that have no admin override on any of their subscription rows.
UPDATE "User" u
SET "subscriptionStatus" = 'PRO'
WHERE u."authMethod" = 'OTP'
  AND u."subscriptionStatus" = 'FREE'
  AND NOT EXISTS (
    SELECT 1 FROM "Subscription" s
    WHERE s."userId" = u."id" AND s."adminOverride" = true
  );
