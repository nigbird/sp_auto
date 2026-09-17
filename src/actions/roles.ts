
'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { requireUser } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/permissions-server';

const ROLE_DESCRIPTIONS: Record<Role, string> = {
    ADMINISTRATOR: "Has all permissions.",
    MANAGER: "Can view reports and manage activities.",
    USER: "Can only view and update their own activities.",
};

const FIXED_ROLES: Role[] = [Role.ADMINISTRATOR, Role.MANAGER, Role.USER];

export async function getRoles() {
    await requireUser();

    const rows = await prisma.rolePermission.findMany();
    const byRole = new Map<Role, string[]>();
    for (const row of rows) {
        byRole.set(row.role, [...(byRole.get(row.role) ?? []), row.permission]);
    }

    return FIXED_ROLES.map((role) => ({
        role,
        name: role.charAt(0) + role.slice(1).toLowerCase(),
        description: ROLE_DESCRIPTIONS[role],
        permissions: byRole.get(role) ?? [],
    }));
}

/**
 * Fully dynamic custom roles (the "Create New Role" page's apparent intent —
 * a free-text role name, not one of the 3 fixed enum values) are out of scope
 * here: Role is a Prisma enum baked into the JWT claim type, Prisma queries,
 * and UI conditionals throughout. This updates permissions for one of the 3
 * existing fixed roles instead.
 */
export async function updateRolePermissions(role: Role, permissions: string[]) {
    await requirePermission('settings:roles:manage');

    await prisma.$transaction([
        prisma.rolePermission.deleteMany({ where: { role } }),
        prisma.rolePermission.createMany({
            data: permissions.map((permission) => ({ role, permission })),
        }),
    ]);

    revalidatePath('/settings/role-management');
    revalidatePath(`/settings/role-management/${role}`);
}
