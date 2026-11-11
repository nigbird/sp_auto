'use server'

import bcrypt from 'bcryptjs';
import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/session';
import { recordAudit, writeAuditLog } from '@/lib/auth/audit';
import { checkPasswordStrength } from '@/lib/auth/password-policy';
import { clearAuthCookies } from '@/lib/auth/cookies';
import { ipFromHeaders } from '@/lib/auth/rate-limit';
import {
  applyEmailChange, createEmailChangeLink, emailInUse, emailSchema, readEmailChangeToken,
  sendEmailChangeConfirmation, sendEmailChangedNotice,
} from '@/lib/auth/email-change';

export type ProfileActionResult =
  | { success: true }
  | { success: false; message: string; field?: 'name' | 'currentPassword' | 'newPassword' | 'email' };

// Wrong current-password attempts allowed per user before changes are paused.
const MAX_FAILED_CHANGES = 5;
const FAILED_CHANGE_WINDOW_MS = 15 * 60 * 1000;

export async function updateMyName(name: string): Promise<ProfileActionResult> {
  const user = await requireUser();
  const trimmed = (name ?? '').trim().replace(/\s+/g, ' ');
  if (trimmed.length < 2) return { success: false, message: 'Name must be at least 2 characters.', field: 'name' };
  if (trimmed.length > 100) return { success: false, message: 'Name must be at most 100 characters.', field: 'name' };

  if (trimmed === user.name) return { success: true };
  await prisma.user.update({ where: { id: user.id }, data: { name: trimmed } });
  await recordAudit({
    action: 'PROFILE_UPDATED', entityType: 'User', entityId: user.id, userId: user.id,
    summary: `Changed name from "${user.name}" to "${trimmed}"`,
  });
  revalidatePath('/', 'layout');
  return { success: true };
}

/**
 * Changes the signed-in user's password after checking the current one, then
 * signs them out everywhere (like a reset) so any other session has to log in again.
 */
export async function changeMyPassword(currentPassword: string, newPassword: string): Promise<ProfileActionResult> {
  const user = await requireUser();
  const h = await headers();
  const ip = ipFromHeaders(h);
  const userAgent = h.get('user-agent');

  const recentFailures = await prisma.auditLog.count({
    where: { action: 'PASSWORD_CHANGE', success: false, userId: user.id, createdAt: { gte: new Date(Date.now() - FAILED_CHANGE_WINDOW_MS) } },
  });
  if (recentFailures >= MAX_FAILED_CHANGES) {
    return { success: false, message: 'Too many wrong attempts. Try again in 15 minutes.' };
  }

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword) {
    return { success: false, message: 'Enter your current password.', field: 'currentPassword' };
  }

  const record = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  const matches = !!record?.passwordHash && await bcrypt.compare(currentPassword, record.passwordHash);
  if (!matches) {
    await writeAuditLog({ action: 'PASSWORD_CHANGE', success: false, identifier: user.email, userId: user.id, actorId: user.id, entityType: 'User', entityId: user.id, summary: 'Wrong current password when changing password', ip, userAgent });
    return { success: false, message: 'Your current password is incorrect.', field: 'currentPassword' };
  }

  const weakness = checkPasswordStrength(newPassword, user);
  if (weakness) return { success: false, message: weakness, field: 'newPassword' };
  if (newPassword === currentPassword) return { success: false, message: 'Choose a password different from your current one.', field: 'newPassword' };

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, sessionVersion: { increment: 1 } } });
    // Any outstanding set/reset links are no longer needed.
    await tx.passwordToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
    const sessions = await tx.activeSession.findMany({ where: { userId: user.id, revokedAt: null }, select: { id: true } });
    const sessionIds = sessions.map((s) => s.id);
    await tx.activeSession.updateMany({ where: { id: { in: sessionIds } }, data: { revokedAt: now } });
    await tx.refreshToken.updateMany({ where: { sessionId: { in: sessionIds }, revokedAt: null }, data: { revokedAt: now } });
  });

  await writeAuditLog({ action: 'PASSWORD_CHANGE', success: true, identifier: user.email, userId: user.id, actorId: user.id, entityType: 'User', entityId: user.id, summary: 'Changed password (signed out of all sessions)', ip, userAgent });
  clearAuthCookies(await cookies());
  return { success: true };
}

/** Wrong current passwords (on password or email change) in the last 15 minutes, which pause both. */
async function recentWrongPasswords(userId: string): Promise<number> {
  return prisma.auditLog.count({
    where: { action: { in: ['PASSWORD_CHANGE', 'EMAIL_CHANGE_REQUESTED'] }, success: false, userId, createdAt: { gte: new Date(Date.now() - FAILED_CHANGE_WINDOW_MS) } },
  });
}

export type EmailChangeRequestResult =
  | { success: true; sentTo: string; link?: string }
  | { success: false; message: string; field?: 'email' | 'currentPassword' };

/**
 * Starts a change of the signed-in user's own email: checks the current
 * password, then emails a confirmation link to the new address. Nothing
 * changes until that link is used, so a typo or someone else's address
 * can't lock the owner out.
 */
export async function requestEmailChange(newEmail: string, currentPassword: string): Promise<EmailChangeRequestResult> {
  const user = await requireUser();
  const h = await headers();
  const ip = ipFromHeaders(h);
  const userAgent = h.get('user-agent');

  if (await recentWrongPasswords(user.id) >= MAX_FAILED_CHANGES) {
    return { success: false, message: 'Too many wrong attempts. Try again in 15 minutes.' };
  }
  const parsed = emailSchema.safeParse(typeof newEmail === 'string' ? newEmail : '');
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]!.message, field: 'email' };
  const to = parsed.data;
  if (to === user.email.toLowerCase()) return { success: false, message: 'This is already your email.', field: 'email' };
  if (typeof currentPassword !== 'string' || !currentPassword) return { success: false, message: 'Enter your current password.', field: 'currentPassword' };

  const record = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  const matches = !!record?.passwordHash && await bcrypt.compare(currentPassword, record.passwordHash);
  if (!matches) {
    await writeAuditLog({ action: 'EMAIL_CHANGE_REQUESTED', success: false, identifier: user.email, userId: user.id, actorId: user.id, entityType: 'User', entityId: user.id, summary: 'Wrong current password when changing email', ip, userAgent });
    return { success: false, message: 'Your current password is incorrect.', field: 'currentPassword' };
  }
  if (await emailInUse(to, user.id)) return { success: false, message: 'Another account already uses this email.', field: 'email' };

  const link = await createEmailChangeLink(user.id, user.email, to);
  const emailed = await sendEmailChangeConfirmation(user, to, link);
  await writeAuditLog({
    action: 'EMAIL_CHANGE_REQUESTED', success: true, identifier: user.email, userId: user.id, actorId: user.id, entityType: 'User', entityId: user.id,
    summary: emailed ? `Asked to change email to ${to} (confirmation link emailed)` : `Asked to change email to ${to} (confirmation email not sent)`,
    metadata: { to, emailed }, ip, userAgent,
  });
  if (emailed) return { success: true, sentTo: to };
  // The link proves the new mailbox is theirs, so outside development it only ever travels by email.
  if (process.env.NODE_ENV !== 'production') return { success: true, sentTo: to, link };
  return { success: false, message: "The confirmation email couldn't be sent. Try again later, or ask an administrator to change your email in Users & Roles." };
}

export type EmailChangeConfirmResult = { success: true; email: string } | { success: false; message: string };

/** Makes the change from the confirmation link, then signs the user out everywhere. */
export async function confirmEmailChange(token: string): Promise<EmailChangeConfirmResult> {
  const found = await readEmailChangeToken(typeof token === 'string' ? token : '');
  if (!found.ok) {
    return {
      success: false,
      message: found.reason === 'expired' ? 'This link has expired. Request the change again from your profile.'
        : found.reason === 'used' ? 'This link has already been used, or your email was changed since.'
        : "This link isn't valid. Check that you copied the whole link from the email.",
    };
  }
  const applied = await applyEmailChange(found.userId, found.from, found.to);
  if (!applied.ok) {
    return { success: false, message: applied.reason === 'taken' ? 'Another account now uses this email, so the change was not made.' : 'Your email was changed since this link was sent.' };
  }
  const h = await headers();
  await writeAuditLog({
    action: 'EMAIL_CHANGED', success: true, identifier: found.to, userId: found.userId, actorId: found.userId, entityType: 'User', entityId: found.userId,
    summary: `Changed sign-in email from ${found.from} to ${found.to} (confirmed from the new address; signed out of all sessions)`,
    metadata: { from: found.from, to: found.to, by: 'self' }, ip: ipFromHeaders(h), userAgent: h.get('user-agent'),
  });
  await sendEmailChangedNotice(found, found.from, found.to, false);
  clearAuthCookies(await cookies());
  return { success: true, email: found.to };
}
