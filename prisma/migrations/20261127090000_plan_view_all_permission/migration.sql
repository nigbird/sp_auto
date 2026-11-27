-- VA-001 (horizontal broken access control): normal staff must only ever see
-- their own activities. 'strategic-plan:view' now means "the plan structure
-- plus my own activities"; seeing everyone's needs 'strategic-plan:view-all'
-- (or another plan-wide permission: edit, plan approvals, full report, full
-- dashboard — see PLAN_WIDE_VIEW in src/lib/auth/permissions.ts).

-- 1. The built-in normal role gets the "only mine" dashboard and report, as in
--    DEFAULT_ROLE_PERMISSIONS, instead of the full (everyone's) versions.
INSERT INTO "RolePermission" ("id", "roleId", "permission", "createdAt")
SELECT 'rp_' || md5(rp."roleId" || m.own_permission || clock_timestamp()::text), rp."roleId", m.own_permission, NOW()
FROM "RolePermission" rp
JOIN "Role" r ON r."id" = rp."roleId" AND r."name" = 'User'
JOIN (VALUES ('dashboard:view', 'dashboard:view-own'), ('reports:view', 'reports:view-own')) AS m(full_permission, own_permission)
  ON m.full_permission = rp."permission"
ON CONFLICT ("roleId", "permission") DO NOTHING;

DELETE FROM "RolePermission" rp
USING "Role" r
WHERE r."id" = rp."roleId" AND r."name" = 'User'
  AND rp."permission" IN ('dashboard:view', 'reports:view');

-- 2. Roles that run, approve or administer plans keep seeing everyone's
--    activities: they get the new permission explicitly.
INSERT INTO "RolePermission" ("id", "roleId", "permission", "createdAt")
SELECT DISTINCT ON (rp."roleId")
       'rp_' || md5(rp."roleId" || 'strategic-plan:view-all' || clock_timestamp()::text), rp."roleId", 'strategic-plan:view-all', NOW()
FROM "RolePermission" rp
WHERE rp."permission" IN (
  'strategic-plan:edit', 'plan-approvals:view', 'plan-approvals:approve',
  'report-approvals:view', 'report-approvals:approve',
  'reports:view', 'dashboard:view', 'users:manage', 'roles:manage'
)
ON CONFLICT ("roleId", "permission") DO NOTHING;
