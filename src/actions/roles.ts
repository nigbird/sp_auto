
'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/permissions-server';
import { ALL_PERMISSIONS } from '@/lib/auth/permissions';

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

export async function createRole(name: string, permissions: string[]) {
    await requirePermission('roles:manage');
    permissions = validPermissions(permissions);

    const trimmedName = name.trim();
    if (!trimmedName) {
        throw new Error('Role name is required.');
    }

    const existing = await prisma.role.findUnique({ where: { name: trimmedName } });
    if (existing) {
        throw new Error(`A role named "${trimmedName}" already exists.`);
    }

    const role = await prisma.role.create({
        data: {
            name: trimmedName,
            isSystem: false,
            permissions: { create: permissions.map((permission) => ({ permission })) },
        },
    });

    revalidatePath('/users/roles');
    return role;
}

export async function updateRolePermissions(roleId: string, permissions: string[]) {
    const user = await requirePermission('roles:manage');
    permissions = validPermissions(permissions);
    // Removing "manage roles" from your own role would lock you out of this page.
    if (roleId === user.roleId && !permissions.includes('roles:manage')) {
        throw new Error("You can't remove 'Create, edit and delete roles' from your own role.");
    }

    await prisma.$transaction([
        prisma.rolePermission.deleteMany({ where: { roleId } }),
        prisma.rolePermission.createMany({
            data: permissions.map((permission) => ({ roleId, permission })),
        }),
    ]);

    revalidatePath('/users/roles');
}

export async function deleteRole(roleId: string) {
    await requirePermission('roles:manage');

    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) return;
    if (role.isSystem) {
        throw new Error('Built-in roles cannot be deleted.');
    }

    const usersWithRole = await prisma.user.count({ where: { roleId } });
    if (usersWithRole > 0) {
        throw new Error(`Cannot delete "${role.name}" — it is still assigned to ${usersWithRole} user(s).`);
    }

    await prisma.role.delete({ where: { id: roleId } });
    revalidatePath('/users/roles');
}
