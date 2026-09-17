/**
 * The permission taxonomy already designed into the (previously mocked)
 * role-management UI (src/app/settings/role-management/create/page.tsx) —
 * adopted as-is rather than inventing a new one, since it's more specific
 * than anything built during the auth pass and already has a UI shaped
 * around it.
 *
 * Client-safe: no server-only imports here (see permissions-server.ts for
 * the DB-backed lookup/enforcement functions) — this file gets imported
 * directly by the client-side role-edit page.
 */
export const PERMISSION_GROUPS = [
  {
    title: 'Dashboard',
    permissions: [{ id: 'dashboard:view', label: 'View Dashboard' }],
  },
  {
    title: 'Activities',
    permissions: [
      { id: 'activities:view', label: 'View All Activities' },
      { id: 'activities:create', label: 'Create Activities' },
      { id: 'activities:edit', label: 'Edit Activities' },
      { id: 'activities:delete', label: 'Delete Activities' },
    ],
  },
  {
    title: 'My Activity',
    permissions: [
      { id: 'my-activity:view', label: 'View Own Activities' },
      { id: 'my-activity:update', label: 'Update Own Activity Progress' },
    ],
  },
  {
    title: 'Reports',
    permissions: [
      { id: 'reports:view', label: 'View Reports' },
      { id: 'reports:export', label: 'Export Reports' },
    ],
  },
  {
    title: 'Settings',
    permissions: [
      { id: 'settings:view', label: 'View Settings' },
      { id: 'settings:users:manage', label: 'Manage Users' },
      { id: 'settings:roles:manage', label: 'Manage Roles' },
    ],
  },
  {
    title: 'Strategic Plan',
    permissions: [
      { id: 'strategic-plan:view', label: 'View Strategic Plan' },
      { id: 'strategic-plan:edit', label: 'Edit Strategic Plan' },
    ],
  },
] as const;

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.id));

/** Default split used to seed RolePermission for the 3 built-in roles (by display name). */
export const DEFAULT_ROLE_PERMISSIONS: Record<'Administrator' | 'Manager' | 'User', string[]> = {
  Administrator: [...ALL_PERMISSIONS],
  Manager: ALL_PERMISSIONS.filter(
    (p) => !['settings:users:manage', 'settings:roles:manage', 'activities:delete'].includes(p)
  ),
  User: ['dashboard:view', 'my-activity:view', 'my-activity:update', 'reports:view', 'strategic-plan:view'],
};
