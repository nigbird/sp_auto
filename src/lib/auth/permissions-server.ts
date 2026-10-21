import { prisma } from '@/lib/prisma';
import { requireUser, type SessionUser } from './session';
import type { Permission } from './permissions';
import { recordDenied } from './audit';

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

/**
 * The permissions in `permissions` that `user` doesn't hold. Anyone who hands
 * out access (assigning a role, editing a role) may only hand out access they
 * have themselves, so a non-empty result means the change must be refused.
 */
export function permissionsBeyond(user: SessionUser, permissions: readonly string[]): string[] {
  return permissions.filter((p) => !user.permissions.includes(p) && !user.permissions.includes(NARROWER_FORM_OF[p] ?? ''));
}

// "View my …" is a narrower form of "View the full …": holding the full one covers it.
const NARROWER_FORM_OF: Record<string, string> = {
  'dashboard:view-own': 'dashboard:view',
  'reports:view-own': 'reports:view',
};

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
    await recordDenied(anyOf, 'action');
    throw new Error("You don't have permission to do this.");
  }
  return user;
}

/** For route handlers: logs the refusal and answers 403. */
export async function forbiddenResponse(required: Permission[], message = "You don't have permission to do this."): Promise<Response> {
  await recordDenied(required, 'download');
  return Response.json({ error: message }, { status: 403 });
}
