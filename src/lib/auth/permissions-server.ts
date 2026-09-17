import { prisma } from '@/lib/prisma';
import { requireUser } from './session';

export async function getPermissionsForRole(roleId: string): Promise<string[]> {
  const rows = await prisma.rolePermission.findMany({ where: { roleId }, select: { permission: true } });
  return rows.map((r) => r.permission);
}

export async function hasPermission(roleId: string, permission: string): Promise<boolean> {
  const match = await prisma.rolePermission.findUnique({
    where: { roleId_permission: { roleId, permission } },
  });
  return !!match;
}

/**
 * Authoritative, DB-backed permission check — used at the top of server
 * actions that mutate data or approve/reject something (the real security
 * boundary; *:view permissions are UI-level hints, not hard-gated here).
 * Checks live DB state rather than the JWT's embedded permissions snapshot,
 * so an admin revoking a permission takes effect immediately rather than
 * waiting for the caller's access token to expire/refresh.
 */
export async function requirePermission(permission: string) {
  const user = await requireUser();
  const allowed = await hasPermission(user.roleId, permission);
  if (!allowed) {
    throw new Error(`You don't have permission to do this ("${permission}" required).`);
  }
  return user;
}
