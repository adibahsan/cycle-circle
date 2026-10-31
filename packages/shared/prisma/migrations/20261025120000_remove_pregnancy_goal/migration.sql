-- Pregnancy mode was removed. Move affected profiles to plain tracking.
-- Safe to re-run (plain UPDATEs).

-- 1) Pregnancy defaulted all three alerts OFF. For pregnancy profiles whose
--    alerts are still exactly that default, restore the tracking defaults (all ON).
UPDATE "NotificationPreference" np
SET "periodAlert" = true, "fertileWindow" = true, "loggingReminder" = true
FROM "Profile" p
WHERE np."profileId" = p."id"
  AND lower(trim(p."goal")) IN ('pregnancy', 'pregnant')
  AND np."periodAlert" = false
  AND np."fertileWindow" = false
  AND np."loggingReminder" = false;

-- 2) Goal -> tracking.
UPDATE "Profile"
SET "goal" = 'tracking'
WHERE lower(trim("goal")) IN ('pregnancy', 'pregnant');
