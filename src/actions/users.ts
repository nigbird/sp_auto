'use server'

import { publicUserSelect } from '@/lib/user-select';
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma';
import type { User } from '@/lib/types';
import { requireUser } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/permissions-server';

const userListSelect = {
    ...publicUserSelect,
    department: true,
    leadOwnerId: true,
    role: { select: { name: true } },
    leadOwner: { select: { name: true } },
} as const;

export async function getUsers(): Promise<User[]> {
    await requireUser();
    const users = await prisma.user.findMany({ select: userListSelect, orderBy: { name: 'asc' } });
    return users.map((u) => ({ ...u, role: u.role.name, roleId: u.roleId, leadOwner: u.leadOwner?.name ?? null })) as unknown as User[];
}

export interface UserInput {
    name: string;
    email: string;
    roleId: string;
    /** Optional office the person holds. */
    leadOwnerId?: string | null;
    /** Optional department name. */
    department?: string | null;
}

export type UserActionResult = { success: true; user: User } | { success: false; message: string; field?: 'name' | 'email' | 'roleId' | 'leadOwnerId' | 'department' };

async function checkInput(data: UserInput, existingEmail?: string): Promise<{ success: false; message: string; field?: 'name' | 'email' | 'roleId' | 'leadOwnerId' | 'department' } | null> {
    const name = (data.name ?? '').trim();
    const email = (data.email ?? '').trim().toLowerCase();
    if (name.length < 2) return { success: false, message: 'Name must be at least 2 characters.', field: 'name' };
    if (!existingEmail) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, message: 'Enter a valid email address.', field: 'email' };
        if (await prisma.user.findUnique({ where: { email } })) return { success: false, message: `A user with the email ${email} already exists.`, field: 'email' };
    }
    if (!data.roleId || !(await prisma.role.findUnique({ where: { id: data.roleId } }))) return { success: false, message: 'Select a role.', field: 'roleId' };
    if (data.leadOwnerId && !(await prisma.leadOwner.findUnique({ where: { id: data.leadOwnerId } }))) return { success: false, message: 'The selected lead owner no longer exists.', field: 'leadOwnerId' };
    if (data.department && !(await prisma.department.findUnique({ where: { name: data.department } }))) return { success: false, message: 'The selected department no longer exists.', field: 'department' };
    return null;
}

async function readUser(id: string): Promise<User> {
    const u = await prisma.user.findUniqueOrThrow({ where: { id }, select: userListSelect });
    return JSON.parse(JSON.stringify({ ...u, role: u.role.name, leadOwner: u.leadOwner?.name ?? null })) as User;
}

export async function createUser(data: UserInput): Promise<UserActionResult> {
    await requirePermission('settings:users:manage');
    const problem = await checkInput(data);
    if (problem) return problem;
    const created = await prisma.user.create({
        data: {
            name: data.name.trim(),
            email: data.email.trim().toLowerCase(),
            roleId: data.roleId,
            leadOwnerId: data.leadOwnerId || null,
            department: data.department || null,
            avatar: `https://picsum.photos/seed/${Math.random()}/100`, // random placeholder
            status: 'ACTIVE',
        },
        select: { id: true },
    });
    revalidatePath('/users');
    return { success: true, user: await readUser(created.id) };
}

/**
 * Registers the person holding a lead-owner office found in an imported plan:
 * creates the office if it isn't on the list yet, then the user with it.
 */
export async function registerLeadOwnerUser(data: Omit<UserInput, 'leadOwnerId'> & { leadOwnerName: string }): Promise<UserActionResult> {
    await requirePermission('settings:users:manage');
    const officeName = (data.leadOwnerName ?? '').replace(/\s+/g, ' ').trim();
    if (!officeName) return { success: false, message: 'The lead owner title is missing.', field: 'leadOwnerId' };
    const department = (data.department ?? '').trim() || null;
    if (department) await prisma.department.upsert({ where: { name: department }, update: {}, create: { name: department } });
    const office = await prisma.leadOwner.findFirst({ where: { name: { equals: officeName, mode: 'insensitive' } } })
        ?? await prisma.leadOwner.create({ data: { name: officeName, department } });
    const result = await createUser({ ...data, department, leadOwnerId: office.id });
    revalidatePath('/settings/organization/lead-owners');
    revalidatePath('/settings/organization/departments');
    return result;
}

export async function updateUser(email: string, data: { name?: string; status?: User['status']; roleId?: string; leadOwnerId?: string | null; department?: string | null }) {
    await requirePermission('settings:users:manage');
    const updateData: Record<string, unknown> = { ...data };
    if ('leadOwnerId' in data) updateData.leadOwnerId = data.leadOwnerId || null;
    if ('department' in data) updateData.department = data.department || null;
    const updatedUser = await prisma.user.update({
        where: { email },
        data: updateData,
        select: publicUserSelect,
    });
    revalidatePath('/users');
    return updatedUser;
}

export async function deleteUser(email: string) {
    await requirePermission('settings:users:manage');
    await prisma.user.delete({ where: { email } });
    revalidatePath('/users');
}
