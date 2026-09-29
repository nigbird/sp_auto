import { prisma } from '@/lib/prisma';
import { requireUser, type SessionUser } from './session';
import type { Permission } from './permissions';

export async function getPermissionsForRole(roleId: string): Promise<string[]> {
  const rows = await prisma.rolePermission.findMany({ where: { roleId }, select: { permission: true } });
  return rows.map((r) => r.permission);
}

export async function hasPermission(roleId: string, permission: Permission): Promise<boolean> {
  const match = await prisma.rolePermission.findUnique({
    where: { roleId_permission: { roleId, permission } },
  });
  return !!match;
}

/** The signed-in user holds `permission` (checked from the live session, which reads the DB). */
export function userCan(user: SessionUser, ...anyOf: Permission[]): boolean {
  return anyOf.some((p) => user.permissions.includes(p));
}

/**
 * The server-side security boundary: call at the top of every server action
 * and data read that needs a permission. Throws if the user holds none of
 * the listed permissions.
 */
export async function requirePermission(...anyOf: Permission[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!userCan(user, ...anyOf)) {
    throw new Error("You don't have permission to do this.");
  }
  return user;
}
