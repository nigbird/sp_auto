'use server'

import bcrypt from 'bcryptjs';
import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/session';
import { writeAuditLog } from '@/lib/auth/audit';
import { checkPasswordStrength } from '@/lib/auth/password-policy';
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from '@/lib/auth/config';

export type ProfileActionResult =
  | { success: true }
  | { success: false; message: string; field?: 'name' | 'currentPassword' | 'newPassword' };

// Wrong current-password attempts allowed per user before changes are paused.
const MAX_FAILED_CHANGES = 5;
const FAILED_CHANGE_WINDOW_MS = 15 * 60 * 1000;

export async function updateMyName(name: string): Promise<ProfileActionResult> {
  const user = await requireUser();
  const trimmed = (name ?? '').trim().replace(/\s+/g, ' ');
  if (trimmed.length < 2) return { success: false, message: 'Name must be at least 2 characters.', field: 'name' };
  if (trimmed.length > 100) return { success: false, message: 'Name must be at most 100 characters.', field: 'name' };

  await prisma.user.update({ where: { id: user.id }, data: { name: trimmed } });
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
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
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
    await writeAuditLog({ action: 'PASSWORD_CHANGE', success: false, identifier: user.email, userId: user.id, ip, userAgent });
    return { success: false, message: 'Your current password is incorrect.', field: 'currentPassword' };
  }

  const weakness = checkPasswordStrength(newPassword);
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

  await writeAuditLog({ action: 'PASSWORD_CHANGE', success: true, identifier: user.email, userId: user.id, ip, userAgent });
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_COOKIE_NAME);
  cookieStore.delete(REFRESH_COOKIE_NAME);
  return { success: true };
}
