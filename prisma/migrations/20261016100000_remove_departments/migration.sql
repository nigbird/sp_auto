-- Departments duplicated the Lead Owners list one-for-one, so they are retired:
-- activities and people are identified by their lead-owner office instead.

-- Keep what the department told us before the columns go.
-- 1. Activities with no lead owner take their department's name (the
--    performance report already fell back to it).
UPDATE "Activity"
SET "leadOwner" = btrim("department")
WHERE ("leadOwner" IS NULL OR btrim("leadOwner") = '')
  AND btrim(COALESCE("department", '')) <> '';

-- 2. People with no office are linked to the lead owner named like their department.
UPDATE "User" u
SET "leadOwnerId" = l."id"
FROM "LeadOwner" l
WHERE u."leadOwnerId" IS NULL
  AND btrim(COALESCE(u."department", '')) <> ''
  AND lower(l."name") = lower(btrim(u."department"));

-- Drop the columns and the list.
ALTER TABLE "Activity" DROP COLUMN "department";
ALTER TABLE "User" DROP COLUMN "department";
ALTER TABLE "LeadOwner" DROP COLUMN "department";
DROP TABLE "Department";
