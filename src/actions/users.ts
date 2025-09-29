
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma';
import type { User } from '@/lib/types';
import { Role } from '@prisma/client';

export async function getUsers(): Promise<User[]> {
    return await prisma.user.findMany();
}

export async function createUser(data: { name: string, email: string, role: User['role'] }) {
    const newUser = await prisma.user.create({
        data: {
            name: data.name,
            email: data.email,
            role: data.role.toUpperCase() as Role,
            avatar: `https://picsum.photos/seed/${Math.random()}/100`, // random placeholder
            status: 'ACTIVE',
            createdAt: new Date(),
        }
    });
    revalidatePath('/settings/user-management');
    return newUser;
}

export async function updateUser(email: string, data: Partial<Pick<User, 'name' | 'role' | 'status'>>) {
    const updateData: any = { ...data };
    if (data.role) {
        updateData.role = data.role.toUpperCase() as Role;
    }
    const updatedUser = await prisma.user.update({
        where: { email },
        data: updateData,
    });
    revalidatePath('/settings/user-management');
    return updatedUser;
}

export async function deleteUser(email: string) {
    await prisma.user.delete({ where: { email } });
    revalidatePath('/settings/user-management');
}
