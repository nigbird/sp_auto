
'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma';
import type { User } from '@/lib/types';
import { requireUser } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/permissions-server';

export async function getUsers(): Promise<User[]> {
    await requireUser();
    const users = await prisma.user.findMany({ include: { role: true } });
    return users.map((u) => ({ ...u, role: u.role.name, roleId: u.roleId })) as unknown as User[];
}

export async function createUser(data: { name: string, email: string, roleId: string }) {
    await requirePermission('settings:users:manage');
    const newUser = await prisma.user.create({
        data: {
            name: data.name,
            email: data.email,
            roleId: data.roleId,
            avatar: `https://picsum.photos/seed/${Math.random()}/100`, // random placeholder
            status: 'ACTIVE',
            createdAt: new Date(),
        }
    });
    revalidatePath('/settings/user-management');
    return newUser;
}

export async function updateUser(email: string, data: { name?: string; status?: User['status']; roleId?: string }) {
    await requirePermission('settings:users:manage');
    const updateData: any = { ...data };
    const updatedUser = await prisma.user.update({
        where: { email },
        data: updateData,
    });
    revalidatePath('/settings/user-management');
    return updatedUser;
}

export async function deleteUser(email: string) {
    await requirePermission('settings:users:manage');
    await prisma.user.delete({ where: { email } });
    revalidatePath('/settings/user-management');
}
