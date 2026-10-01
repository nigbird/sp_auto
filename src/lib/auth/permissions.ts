/**
 * Every permission in the app, grouped the same way as the sidebar. Each
 * page and each server action checks one of these ids; the role editor
 * (src/components/settings/role-form.tsx) lists exactly this catalogue.
 *
 * Client-safe: no server-only imports (see permissions-server.ts for the
 * DB-backed checks).
 */
export const PERMISSION_GROUPS = [
  {
    title: 'Dashboard',
    permissions: [
      { id: 'dashboard:view', label: 'View the full dashboard' },
      { id: 'dashboard:view-own', label: 'View my dashboard (only my activities)' },
    ],
  },
  {
    title: 'Strategic Plans',
    permissions: [
      { id: 'strategic-plan:view', label: 'View strategic plans' },
      { id: 'strategic-plan:edit', label: 'Create, import, edit and publish plans' },
      { id: 'strategic-plan:delete', label: 'Delete plans' },
    ],
  },
  {
    title: 'My Plan',
    permissions: [
      { id: 'my-plan:view', label: 'View my activities' },
      { id: 'my-plan:update', label: 'Fill in breakdowns and add activities' },
    ],
  },
  {
    title: 'Plan Approvals',
    permissions: [
      { id: 'plan-approvals:view', label: 'View plan approvals' },
      { id: 'plan-approvals:approve', label: 'Approve or return activities and breakdowns' },
      { id: 'plan-approvals:request', label: 'Send breakdown requests' },
    ],
  },
  {
    title: 'My Reports',
    permissions: [
      { id: 'my-reports:view', label: 'View my reports' },
      { id: 'my-reports:submit', label: 'Submit reports and attach evidence' },
    ],
  },
  {
    title: 'Report Approvals',
    permissions: [
      { id: 'report-approvals:view', label: 'View submitted reports' },
      { id: 'report-approvals:approve', label: 'Approve or return reports' },
      { id: 'report-approvals:request', label: 'Send report requests' },
    ],
  },
  {
    title: 'Performance Report',
    permissions: [
      { id: 'reports:view', label: 'View the full performance report' },
      { id: 'reports:view-own', label: 'View my performance report (only my activities)' },
      { id: 'reports:export', label: 'Export reports' },
    ],
  },
  {
    title: 'Users & Roles',
    permissions: [
      { id: 'users:view', label: 'View users and roles' },
      { id: 'users:manage', label: 'Register, edit and deactivate users' },
      { id: 'roles:manage', label: 'Create, edit and delete roles' },
    ],
  },
  {
    title: 'Configuration',
    permissions: [
      { id: 'settings:view', label: 'View configuration' },
      { id: 'settings:manage', label: 'Change reporting periods, rules, departments and lead owners' },
    ],
  },
  {
    title: 'Audit Log',
    permissions: [
      { id: 'audit:view', label: 'View the audit log (who did what, and when)' },
      { id: 'audit:export', label: 'Export the audit log' },
    ],
  },
] as const;

export type Permission = (typeof PERMISSION_GROUPS)[number]['permissions'][number]['id'];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.id));

/** Default split used to seed RolePermission for the 3 built-in roles (by display name). */
export const DEFAULT_ROLE_PERMISSIONS: Record<'Administrator' | 'Manager' | 'User', Permission[]> = {
  Administrator: [...ALL_PERMISSIONS],
  Manager: ALL_PERMISSIONS.filter((p) => !['users:manage', 'roles:manage', 'strategic-plan:delete', 'settings:manage', 'audit:view', 'audit:export', 'dashboard:view-own', 'reports:view-own'].includes(p)),
  User: ['dashboard:view-own', 'strategic-plan:view', 'my-plan:view', 'my-plan:update', 'my-reports:view', 'my-reports:submit', 'reports:view-own'],
};

/** True if the list grants at least one of the given permissions. */
export function hasAny(granted: readonly string[] | null | undefined, ...required: Permission[]): boolean {
  return !!granted && required.some((p) => granted.includes(p));
}
