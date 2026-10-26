import type { Permission } from './permissions';

/**
 * The permissions each protected page needs, mirroring the guardPage() calls in
 * the pages and layouts under src/app. Edge-safe: middleware uses it to answer
 * a forbidden page with HTTP 403 before anything renders. guardPage() stays the
 * authoritative check (it reads the live role from the database), so keep the
 * two in step when adding a page.
 *
 * Each entry lists groups that must all be satisfied; within a group any one
 * permission is enough. The first matching entry wins, so specific paths come first.
 */
const ROUTE_RULES: { path: string; subtree: boolean; need: Permission[][] }[] = [
  { path: '/strategic-plan/create', subtree: true, need: [['strategic-plan:view'], ['strategic-plan:edit']] },
  { path: '/strategic-plan/edit', subtree: true, need: [['strategic-plan:view'], ['strategic-plan:edit']] },
  { path: '/strategic-plan/import', subtree: true, need: [['strategic-plan:view'], ['strategic-plan:edit']] },
  { path: '/strategic-plan', subtree: true, need: [['strategic-plan:view']] },
  { path: '/users', subtree: true, need: [['users:view']] },
  { path: '/audit', subtree: true, need: [['audit:view']] },
  { path: '/settings', subtree: true, need: [['settings:view']] },
  { path: '/plan/approvals', subtree: true, need: [['plan-approvals:view']] },
  { path: '/plan', subtree: false, need: [['my-plan:view']] },
  { path: '/reports/approvals', subtree: true, need: [['report-approvals:view']] },
  { path: '/reports/submit', subtree: true, need: [['my-reports:view']] },
  { path: '/reports/summary', subtree: true, need: [['reports:view']] },
  { path: '/reports', subtree: false, need: [['reports:view', 'reports:view-own']] },
];

/** The permission groups `pathname` needs, or null when it isn't a protected page. */
export function requiredPermissions(pathname: string): Permission[][] | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const rule = ROUTE_RULES.find((r) => path === r.path || (r.subtree && path.startsWith(`${r.path}/`)));
  return rule?.need ?? null;
}

export function satisfies(granted: readonly string[] | undefined, need: Permission[][]): boolean {
  return need.every((group) => group.some((p) => granted?.includes(p)));
}
