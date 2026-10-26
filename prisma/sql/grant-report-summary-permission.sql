-- Grants "Generate and edit the report summary" (reports:summary) to every role
-- that can approve reports, as migration 20261026090000_report_summary does.
-- For databases updated with `prisma db push`, which creates the tables but
-- doesn't run migration data steps. Safe to run more than once:
--   npx prisma db execute --file prisma/sql/grant-report-summary-permission.sql --schema prisma/schema.prisma
INSERT INTO "RolePermission" ("id", "roleId", "permission", "createdAt")
SELECT 'rp_' || md5(rp."roleId" || 'reports:summary' || clock_timestamp()::text), rp."roleId", 'reports:summary', NOW()
FROM "RolePermission" rp
WHERE rp."permission" = 'report-approvals:approve'
ON CONFLICT ("roleId", "permission") DO NOTHING;
