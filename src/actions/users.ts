'use server'

import { publicUserSelect, safeAvatar } from '@/lib/user-select';
import { revalidatePath } from 'next/cache'
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import type { User } from '@/lib/types';
import { requireUser, type SessionUser } from '@/lib/auth/session';
import { getPermissionsForRole, permissionsBeyond, requirePermission, userCan } from '@/lib/auth/permissions-server';
import { sendPasswordLink, type SentLink } from '@/lib/auth/password-tokens';
import { changedFields, recordAudit, writeAuditLog } from '@/lib/auth/audit';

const nameSchema = z.string().trim().min(2, 'Name must be at least 2 characters.').max(100, 'Name must be at most 100 characters.')
    .regex(/^[^<>{}\u0000-\u001f\u007f]+$/, 'The name contains characters that are not allowed.');
const emailSchema = z.string().trim().toLowerCase().max(254, 'The email address is too long.').email('Enter a valid email address.');
const idSchema = z.string().trim().min(1).max(64);

const userListSelect = {
    ...publicUserSelect,
    leadOwnerId: true,
    role: { select: { name: true } },
    leadOwner: { select: { name: true } },
    lastLoginAt: true,
    passwordTokens: { where: { purpose: 'INVITE' }, orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true, expiresAt: true } },
} as const;

type UserRow = { avatar: string; lastLoginAt: Date | null; passwordTokens: { createdAt: Date; expiresAt: Date }[]; role: { name: string }; leadOwner: { name: string } | null };

function toUser<T extends UserRow>({ passwordTokens, lastLoginAt, ...u }: T) {
    const invite = passwordTokens[0];
    return {
        ...u,
        avatar: safeAvatar(u.avatar),
        role: u.role.name,
        leadOwner: u.leadOwner?.name ?? null,
        lastLoginAt,
        invitePending: lastLoginAt === null,
        inviteSentAt: invite?.createdAt ?? null,
        inviteExpiresAt: invite?.expiresAt ?? null,
    };
}

/**
 * Everyone, for people pickers across the app. Sign-in and invitation details
 * are account administration, so they're only included for people who can see the Users page.
 */
export async function getUsers(): Promise<User[]> {
    const viewer = await requireUser();
    const users = await prisma.user.findMany({ select: userListSelect, orderBy: { name: 'asc' } });
    const rows = users.map(toUser);
    if (userCan(viewer, 'users:view', 'users:manage')) return rows as unknown as User[];
    return rows.map(({ lastLoginAt, invitePending, inviteSentAt, inviteExpiresAt, ...u }) => u) as unknown as User[];
}

/** Invitation links are credentials: only hand one to the administrator when explicitly allowed (see deliverInvite). */
function mayShowInviteLink(): boolean {
    return process.env.NODE_ENV !== 'production' || process.env.ALLOW_MANUAL_INVITE_LINKS?.trim().toLowerCase() === 'true';
}

/**
 * Refuses a role assignment that would hand out more access than the person
 * doing it has (e.g. a user manager making someone, or a second account of
 * their own, an Administrator).
 */
async function checkRoleAssignable(actor: SessionUser, roleId: string): Promise<string | null> {
    const beyond = permissionsBeyond(actor, await getPermissionsForRole(roleId));
    return beyond.length > 0 ? "You can't assign a role that has permissions you don't have yourself." : null;
}

export interface UserInput {
    name: string;
    email: string;
    roleId: string;
    /** Optional office the person holds. */
    leadOwnerId?: string | null;
}

/**
 * `invite.link` is only returned when the email could not be sent (e.g. SMTP isn't
 * configured), so the administrator can pass it on by hand.
 */
export type InviteOutcome = { emailed: boolean; link?: string };

export type UserActionResult = { success: true; user: User; invite: InviteOutcome } | { success: false; message: string; field?: 'name' | 'email' | 'roleId' | 'leadOwnerId' };

async function checkInput(actor: SessionUser, data: UserInput): Promise<{ success: false; message: string; field?: 'name' | 'email' | 'roleId' | 'leadOwnerId' } | null> {
    const name = nameSchema.safeParse(data?.name ?? '');
    if (!name.success) return { success: false, message: name.error.issues[0]!.message, field: 'name' };
    const email = emailSchema.safeParse(data?.email ?? '');
    if (!email.success) return { success: false, message: email.error.issues[0]!.message, field: 'email' };
    if (await prisma.user.findUnique({ where: { email: email.data } })) return { success: false, message: `A user with the email ${email.data} already exists.`, field: 'email' };
    if (!idSchema.safeParse(data.roleId).success || !(await prisma.role.findUnique({ where: { id: data.roleId } }))) return { success: false, message: 'Select a role.', field: 'roleId' };
    const escalation = await checkRoleAssignable(actor, data.roleId);
    if (escalation) return { success: false, message: escalation, field: 'roleId' };
    if (data.leadOwnerId && (!idSchema.safeParse(data.leadOwnerId).success || !(await prisma.leadOwner.findUnique({ where: { id: data.leadOwnerId } })))) return { success: false, message: 'The selected lead owner no longer exists.', field: 'leadOwnerId' };
    return null;
}

async function readUser(id: string): Promise<User> {
    const u = await prisma.user.findUniqueOrThrow({ where: { id }, select: userListSelect });
    return JSON.parse(JSON.stringify(toUser(u))) as User;
}

export async function createUser(data: UserInput): Promise<UserActionResult> {
    const actor = await requirePermission('users:manage');
    const problem = await checkInput(actor, data);
    if (problem) return problem;
    const email = emailSchema.parse(data.email);
    const created = await prisma.user.create({
        data: {
            name: nameSchema.parse(data.name).replace(/\s+/g, ' '),
            email,
            roleId: data.roleId,
            leadOwnerId: data.leadOwnerId || null,
            avatar: '', // shown as the person's initials
            status: 'ACTIVE',
        },
        select: { id: true, name: true, email: true, role: { select: { name: true } } },
    }).catch((error: unknown) => {
        // Someone registered the same email between the check above and this insert.
        if ((error as { code?: string })?.code === 'P2002') return null;
        throw error;
    });
    if (!created) return { success: false, message: `A user with the email ${email} already exists.`, field: 'email' };
    await recordAudit({
        action: 'USER_CREATED', entityType: 'User', entityId: created.id, userId: created.id,
        summary: `Registered ${created.name} (${created.email}) as ${created.role.name}`,
        metadata: { roleId: data.roleId, leadOwnerId: data.leadOwnerId || null },
    });
    const invite = await deliverInvite(created);
    revalidatePath('/users');
    return { success: true, user: await readUser(created.id), invite };
}

async function deliverInvite(user: { id: string; name: string; email: string }): Promise<InviteOutcome> {
    const actor = await requireUser();
    const sent: SentLink = await sendPasswordLink(user, 'INVITE');
    await writeAuditLog({
        action: 'INVITE_SENT', success: sent.emailed, identifier: user.email, userId: user.id, actorId: actor.id,
        entityType: 'User', entityId: user.id,
        summary: sent.emailed ? `Emailed an invitation to ${user.name}` : `Created an invitation link for ${user.name} (email not sent)`,
        metadata: { by: actor.id },
    });
    if (sent.emailed) return { emailed: true };
    // A set-password link is as good as a password, so in production it only ever travels by email
    // unless ALLOW_MANUAL_INVITE_LINKS=true lets the administrator pass it on by hand.
    return mayShowInviteLink() ? { emailed: false, link: sent.link } : { emailed: false };
}

/**
 * Sends a fresh set-password invitation (voiding the previous one). Only
 * possible until the user signs in for the first time; after that they use
 * "Forgot password?" on the sign-in page.
 */
export async function resendInvite(userId: string): Promise<{ success: true; invite: InviteOutcome } | { success: false; message: string }> {
    await requirePermission('users:manage');
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, status: true, lastLoginAt: true } });
    if (!user) return { success: false, message: 'This user no longer exists.' };
    if (user.lastLoginAt) return { success: false, message: `${user.name} has already signed in. They can use "Forgot password?" on the sign-in page instead.` };
    if (user.status !== 'ACTIVE') return { success: false, message: `${user.name} is deactivated. Activate them before resending the invitation.` };
    const invite = await deliverInvite(user);
    revalidatePath('/users');
    return { success: true, invite };
}

/**
 * Registers the person holding a lead-owner office found in an imported plan:
 * creates the office if it isn't on the list yet, then the user with it.
 */
export async function registerLeadOwnerUser(data: Omit<UserInput, 'leadOwnerId'> & { leadOwnerName: string }): Promise<UserActionResult> {
    const actor = await requirePermission('users:manage');
    const officeName = String(data?.leadOwnerName ?? '').replace(/\s+/g, ' ').trim();
    if (!officeName) return { success: false, message: 'The lead owner title is missing.', field: 'leadOwnerId' };
    if (officeName.length > 200) return { success: false, message: 'The lead owner title is too long.', field: 'leadOwnerId' };
    // Check the person first so a rejected registration doesn't leave a new office behind.
    const problem = await checkInput(actor, { ...data, leadOwnerId: null });
    if (problem) return problem;
    const office = await prisma.leadOwner.findFirst({ where: { name: { equals: officeName, mode: 'insensitive' } } })
        ?? await prisma.leadOwner.create({ data: { name: officeName } });
    const result = await createUser({ ...data, leadOwnerId: office.id });
    revalidatePath('/settings/organization/lead-owners');
    return result;
}

/**
 * Edits a user's name, role and office — nothing else. The fields are copied
 * one by one rather than spreading `data`: a server action accepts whatever
 * JSON the caller sends, and spreading it would let a crafted request rewrite
 * the email (account takeover), status or password hash.
 */
export async function updateUser(email: string, data: { name?: string; roleId?: string; leadOwnerId?: string | null }) {
    const actor = await requirePermission('users:manage');
    const updateData: { name?: string; roleId?: string; leadOwnerId?: string | null } = {};
    if (data?.name !== undefined) {
        const name = nameSchema.safeParse(data.name);
        if (!name.success) throw new Error(name.error.issues[0]!.message);
        updateData.name = name.data.replace(/\s+/g, ' ');
    }
    if (data?.roleId !== undefined) {
        if (!idSchema.safeParse(data.roleId).success || !(await prisma.role.findUnique({ where: { id: data.roleId } }))) throw new Error('Select a role.');
        updateData.roleId = data.roleId;
    }
    if (data && 'leadOwnerId' in data) {
        if (data.leadOwnerId && (!idSchema.safeParse(data.leadOwnerId).success || !(await prisma.leadOwner.findUnique({ where: { id: data.leadOwnerId } })))) throw new Error('The selected lead owner no longer exists.');
        updateData.leadOwnerId = data.leadOwnerId || null;
    }
    const before = await prisma.user.findUnique({ where: { email: String(email) }, select: { id: true, name: true, roleId: true, leadOwnerId: true, role: { select: { name: true } } } });
    if (!before) throw new Error('This user no longer exists.');
    if (updateData.roleId && updateData.roleId !== before.roleId) {
        if (before.id === actor.id) throw new Error("You can't change your own role. Ask another administrator.");
        const escalation = await checkRoleAssignable(actor, updateData.roleId);
        if (escalation) {
            await recordAudit({
                action: 'PERMISSION_DENIED', success: false, entityType: 'User', entityId: before.id, userId: before.id,
                summary: `Refused to give ${before.name} a role with more access than the person assigning it`,
                metadata: { roleId: updateData.roleId },
            });
            throw new Error(escalation);
        }
    }
    const updatedUser = await prisma.user.update({
        where: { id: before.id },
        data: updateData,
        select: publicUserSelect,
    });
    const changes = changedFields(before, updateData);
    if (Object.keys(changes).length > 0) {
        const roleChange = 'roleId' in changes ? await prisma.role.findUnique({ where: { id: String(updateData.roleId) }, select: { name: true } }) : null;
        await recordAudit({
            action: 'USER_UPDATED', entityType: 'User', entityId: updatedUser.id, userId: updatedUser.id,
            summary: roleChange
                ? `Changed ${updatedUser.name}'s role from ${before!.role.name} to ${roleChange.name}`
                : `Edited ${updatedUser.name} (${Object.keys(changes).join(', ')})`,
            metadata: { changes },
        });
    }
    revalidatePath('/users');
    return updatedUser;
}

/**
 * Users are never deleted — their name stays on plans, reports and approvals.
 * Deactivating blocks sign-in at once (every request checks the status) and
 * voids their existing sessions, so reactivating later needs a fresh sign-in.
 */
export async function setUserStatus(userId: string, status: 'ACTIVE' | 'INACTIVE'): Promise<{ success: true } | { success: false; message: string }> {
    const actor = await requirePermission('users:manage');
    if (status !== 'ACTIVE' && status !== 'INACTIVE') return { success: false, message: 'Unknown status.' };
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, status: true } });
    if (!user) return { success: false, message: 'This user no longer exists.' };
    if (user.status === status) return { success: true };
    if (status === 'INACTIVE' && user.id === actor.id) {
        return { success: false, message: "You can't deactivate your own account. Ask another administrator." };
    }

    await prisma.user.update({
        where: { id: user.id },
        data: status === 'INACTIVE' ? { status, sessionVersion: { increment: 1 } } : { status },
    });
    await recordAudit({
        action: status === 'INACTIVE' ? 'USER_DEACTIVATED' : 'USER_ACTIVATED',
        identifier: user.email, userId: user.id, entityType: 'User', entityId: user.id,
        summary: `${status === 'INACTIVE' ? 'Deactivated' : 'Activated'} ${user.name}`,
        metadata: { by: actor.id },
    });
    revalidatePath('/users');
    return { success: true };
}
