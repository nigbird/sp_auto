
'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma';
import type { SessionUser } from '@/lib/auth/session';
import { permissionsBeyond, requirePermission } from '@/lib/auth/permissions-server';
import { ALL_PERMISSIONS } from '@/lib/auth/permissions';
import { recordAudit } from '@/lib/auth/audit';

export async function getRoles() {
    await requirePermission('users:view', 'users:manage', 'roles:manage');

    const roles = await prisma.role.findMany({
        include: { permissions: { select: { permission: true } } },
        orderBy: { createdAt: 'asc' },
    });

    return roles.map((role) => ({
        id: role.id,
        name: role.name,
        isSystem: role.isSystem,
        permissions: role.permissions.map((p) => p.permission),
    }));
}

/** Keeps only known permission ids (dropping duplicates), so a role can't be given made-up permissions. */
function validPermissions(permissions: unknown): string[] {
    if (!Array.isArray(permissions)) return [];
    const known = new Set<string>(ALL_PERMISSIONS);
    return Array.from(new Set(permissions.filter((p): p is string => typeof p === 'string' && known.has(p))));
}

/**
 * Refusals a person can act on are returned, not thrown: production builds of
 * Next.js replace a thrown server-action message with a generic one, so a thrown
 * "still assigned to 3 users" reached the page as a meaningless digest.
 */
export type RoleActionResult = { success: true } | { success: false; message: string };
const fail = (message: string): RoleActionResult => ({ success: false, message });

/** A role editor may only hand out permissions they hold themselves. Returns the refusal, or null. */
function grantRefusal(user: SessionUser, permissions: string[]): string | null {
    return permissionsBeyond(user, permissions).length > 0
        ? "You can't grant permissions that your own role doesn't have."
        : null;
}

export async function createRole(name: string, permissions: string[]): Promise<RoleActionResult> {
    const user = await requirePermission('roles:manage');
    permissions = validPermissions(permissions);
    const refusal = grantRefusal(user, permissions);
    if (refusal) return fail(refusal);

    const trimmedName = String(name ?? '').trim().replace(/\s+/g, ' ');
    if (!trimmedName) {
        return fail('Role name is required.');
    }
    if (trimmedName.length > 60 || /[<>{}\u0000-\u001f\u007f]/.test(trimmedName)) {
        return fail('Use a role name of at most 60 characters, without < > { }.');
    }

    const existing = await prisma.role.findUnique({ where: { name: trimmedName } });
    if (existing) {
        return fail(`A role named "${trimmedName}" already exists.`);
    }

    const role = await prisma.role.create({
        data: {
            name: trimmedName,
            isSystem: false,
            permissions: { create: permissions.map((permission) => ({ permission })) },
        },
    });
    await recordAudit({
        action: 'ROLE_CREATED', entityType: 'Role', entityId: role.id,
        summary: `Created role "${role.name}" with ${permissions.length} permission${permissions.length === 1 ? '' : 's'}`,
        metadata: { permissions },
    });

    revalidatePath('/users/roles');
    return { success: true };
}

export async function updateRolePermissions(roleId: string, permissions: string[]): Promise<RoleActionResult> {
    const user = await requirePermission('roles:manage');
    permissions = validPermissions(permissions);
    // Removing "manage roles" from your own role would lock you out of this page.
    if (roleId === user.roleId && !permissions.includes('roles:manage')) {
        return fail("You can't remove 'Create, edit and delete roles' from your own role.");
    }

    const role = await prisma.role.findUnique({ where: { id: String(roleId) }, include: { permissions: { select: { permission: true } } } });
    if (!role) return fail('This role no longer exists. Refresh the page to see the current list.');
    const before = role.permissions.map((p) => p.permission);
    // Only newly added permissions count: keeping ones the role already had is fine.
    const refusal = grantRefusal(user, permissions.filter((p) => !before.includes(p)));
    if (refusal) return fail(refusal);

    await prisma.$transaction([
        prisma.rolePermission.deleteMany({ where: { roleId } }),
        prisma.rolePermission.createMany({
            data: permissions.map((permission) => ({ roleId, permission })),
        }),
    ]);

    const added = permissions.filter((p) => !before.includes(p));
    const removed = before.filter((p) => !permissions.includes(p));
    if (added.length > 0 || removed.length > 0) {
        await recordAudit({
            action: 'ROLE_PERMISSIONS_UPDATED', entityType: 'Role', entityId: roleId,
            summary: `Changed "${role.name}" permissions: ${[added.length && `+${added.length} granted`, removed.length && `${removed.length} removed`].filter(Boolean).join(', ')}`,
            metadata: { added, removed },
        });
    }

    revalidatePath('/users/roles');
    return { success: true };
}

export async function deleteRole(roleId: string): Promise<RoleActionResult> {
    await requirePermission('roles:manage');

    const role = await prisma.role.findUnique({ where: { id: String(roleId) } });
    if (!role) return fail('This role no longer exists. Refresh the page to see the current list.');
    if (role.isSystem) {
        return fail('Built-in roles cannot be deleted.');
    }

    const usersWithRole = await prisma.user.count({ where: { roleId: role.id } });
    if (usersWithRole > 0) {
        const who = usersWithRole === 1 ? '1 user' : `${usersWithRole} users`;
        return fail(`"${role.name}" is still assigned to ${who}. Give ${usersWithRole === 1 ? 'that user' : 'them'} a different role first, then delete it.`);
    }

    await prisma.role.delete({ where: { id: role.id } });
    await recordAudit({ action: 'ROLE_DELETED', entityType: 'Role', entityId: role.id, summary: `Deleted role "${role.name}"` });
    revalidatePath('/users/roles');
    return { success: true };
}
