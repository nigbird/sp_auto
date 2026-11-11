import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { escapeHtml, sendEmail } from '@/lib/email';
import { decryptFromCookie, encryptForCookie } from './crypto';
import { APP_NAME, getAppOrigin, layout } from './password-tokens';

/**
 * Changing a user's sign-in email. The email is the username and where
 * password resets go, so a change always signs the user out everywhere and
 * voids their outstanding set/reset links, and the old address is told.
 *
 * A self-service change is confirmed from the new address: the link carries
 * an encrypted, authenticated token (user, old and new address, expiry), so
 * no table is needed. It only works while the account still has the old
 * address, which makes it single-use.
 */

export const emailSchema = z.string().trim().toLowerCase().max(254, 'The email address is too long.').email('Enter a valid email address.');

export const EMAIL_CHANGE_TTL_SECONDS = 60 * 60; // 1 hour

interface EmailChangeClaim {
  p: 'email-change';
  u: string;
  from: string;
  to: string;
  exp: number;
}

export async function createEmailChangeLink(userId: string, from: string, to: string): Promise<string> {
  const claim: EmailChangeClaim = { p: 'email-change', u: userId, from, to, exp: Date.now() + EMAIL_CHANGE_TTL_SECONDS * 1000 };
  const token = await encryptForCookie(JSON.stringify(claim));
  return `${await getAppOrigin()}/confirm-email?token=${encodeURIComponent(token)}`;
}

export type EmailChangeLookup =
  | { ok: true; userId: string; from: string; to: string; name: string }
  | { ok: false; reason: 'invalid' | 'expired' | 'used' };

/** Reads and checks a confirmation link's token. */
export async function readEmailChangeToken(token: string): Promise<EmailChangeLookup> {
  if (!token || token.length > 2000) return { ok: false, reason: 'invalid' };
  const plain = await decryptFromCookie(token);
  let claim: EmailChangeClaim;
  try {
    claim = JSON.parse(plain ?? '');
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (claim?.p !== 'email-change' || typeof claim.u !== 'string' || typeof claim.from !== 'string' || typeof claim.to !== 'string' || typeof claim.exp !== 'number') {
    return { ok: false, reason: 'invalid' };
  }
  if (claim.exp < Date.now()) return { ok: false, reason: 'expired' };
  const user = await prisma.user.findUnique({ where: { id: claim.u }, select: { email: true, name: true, status: true } });
  if (!user || user.status !== 'ACTIVE') return { ok: false, reason: 'invalid' };
  if (user.email !== claim.from) return { ok: false, reason: 'used' };
  return { ok: true, userId: claim.u, from: claim.from, to: claim.to, name: user.name };
}

export type ApplyResult = { ok: true } | { ok: false; reason: 'taken' | 'changed' };

/**
 * Moves the account from `from` to `to`, only if it still has `from`. Signs
 * the user out everywhere and voids outstanding set/reset links, all in one
 * transaction.
 */
export async function applyEmailChange(userId: string, from: string, to: string): Promise<ApplyResult> {
  const now = new Date();
  try {
    return await prisma.$transaction(async (tx) => {
      const moved = await tx.user.updateMany({ where: { id: userId, email: from }, data: { email: to, sessionVersion: { increment: 1 } } });
      if (moved.count === 0) return { ok: false, reason: 'changed' } as const;
      await tx.passwordToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
      const sessions = await tx.activeSession.findMany({ where: { userId, revokedAt: null }, select: { id: true } });
      const sessionIds = sessions.map((s) => s.id);
      await tx.activeSession.updateMany({ where: { id: { in: sessionIds } }, data: { revokedAt: now } });
      await tx.refreshToken.updateMany({ where: { sessionId: { in: sessionIds }, revokedAt: null }, data: { revokedAt: now } });
      return { ok: true } as const;
    });
  } catch (error) {
    // Another account took the address in the meantime (unique email).
    if ((error as { code?: string })?.code === 'P2002') return { ok: false, reason: 'taken' };
    throw error;
  }
}

export async function emailInUse(email: string, exceptUserId?: string): Promise<boolean> {
  const found = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return !!found && found.id !== exceptUserId;
}

/** Sent to the new address: the link that makes the change. */
export async function sendEmailChangeConfirmation(user: { name: string }, to: string, link: string): Promise<boolean> {
  const intro = `You asked to change the email you use to sign in to the ${APP_NAME} workspace to ${to}.`;
  const footnote = "This link expires in 1 hour and can be used once. If you didn't ask for this, ignore this email — nothing will change.";
  return sendEmail({
    to,
    subject: `Confirm your new ${APP_NAME} email`,
    text: `Hello ${user.name},\n\n${intro}\n\nConfirm the change here:\n${link}\n\n${footnote}`,
    html: layout(`Hello ${user.name}`, [intro, 'Confirm it to start signing in with this address.'], link, 'Confirm my new email', footnote),
  });
}

/** Sent to the old address once the change is made, so a change the owner didn't make doesn't go unnoticed. */
export async function sendEmailChangedNotice(user: { name: string }, from: string, to: string, byAdministrator: boolean): Promise<boolean> {
  const what = `The sign-in email for your ${APP_NAME} account was changed from ${from} to ${to}${byAdministrator ? ' by an administrator' : ''}.`;
  const next = "You've been signed out. Sign in with the new address from now on.";
  const warn = "If you didn't expect this, contact your system administrator straight away.";
  return sendEmail({
    to: from,
    subject: `Your ${APP_NAME} sign-in email was changed`,
    text: `Hello ${user.name},\n\n${what}\n\n${next}\n\n${warn}`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#3d2c20">
  <h2 style="margin:0 0 16px;color:#5B4030">Hello ${escapeHtml(user.name)}</h2>
  <p style="line-height:1.5">${escapeHtml(what)}</p>
  <p style="line-height:1.5">${escapeHtml(next)}</p>
  <p style="line-height:1.5;font-weight:bold">${escapeHtml(warn)}</p>
</div>`,
  });
}
