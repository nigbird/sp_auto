import { headers } from 'next/headers';
import bcrypt from 'bcryptjs';
import type { PasswordTokenPurpose } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { escapeHtml, sendEmail } from '@/lib/email';
import { getTrustedOrigin } from './config';
import { generateOpaqueToken, sha256Hex } from './crypto';

export const INVITE_TOKEN_TTL_SECONDS = 72 * 60 * 60; // 3 days
export const RESET_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

const TTL: Record<PasswordTokenPurpose, number> = { INVITE: INVITE_TOKEN_TTL_SECONDS, RESET: RESET_TOKEN_TTL_SECONDS };

/** The public origin for links in emails: APP_ORIGIN when set, otherwise the current request's host. */
export async function getAppOrigin(): Promise<string> {
  const configured = getTrustedOrigin();
  if (configured) return configured.replace(/\/+$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:9003';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/**
 * Issues a fresh single-use link for the user, voiding any earlier unused link
 * of the same kind so only the most recently sent email works.
 */
async function issuePasswordToken(userId: string, purpose: PasswordTokenPurpose): Promise<string> {
  const raw = generateOpaqueToken();
  const tokenHash = await sha256Hex(raw);
  await prisma.$transaction([
    prisma.passwordToken.updateMany({ where: { userId, purpose, usedAt: null, expiresAt: { gt: new Date() } }, data: { expiresAt: new Date() } }),
    prisma.passwordToken.create({
      data: { userId, purpose, tokenHash, expiresAt: new Date(Date.now() + TTL[purpose] * 1000) },
    }),
  ]);
  return raw;
}

export type SentLink = { emailed: boolean; link: string };

/** Creates a set-password link for the user and emails it. */
export async function sendPasswordLink(
  user: { id: string; name: string; email: string },
  purpose: PasswordTokenPurpose
): Promise<SentLink> {
  const token = await issuePasswordToken(user.id, purpose);
  const link = `${await getAppOrigin()}/set-password?token=${encodeURIComponent(token)}`;
  const emailed = await sendEmail(purpose === 'INVITE' ? inviteEmail(user, link) : resetEmail(user, link));
  return { emailed, link };
}

const APP_NAME = 'Nib International Bank Strategic Plan';

function layout(heading: string, paragraphs: string[], link: string, buttonLabel: string, footnote: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#3d2c20">
  <h2 style="margin:0 0 16px;color:#5B4030">${escapeHtml(heading)}</h2>
  ${paragraphs.map((p) => `<p style="line-height:1.5">${escapeHtml(p)}</p>`).join('\n  ')}
  <p style="margin:28px 0"><a href="${escapeHtml(link)}" style="background:#D9A441;color:#4E3726;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">${escapeHtml(buttonLabel)}</a></p>
  <p style="font-size:13px;color:#8A7361;line-height:1.5">If the button doesn't work, copy this link into your browser:<br><a href="${escapeHtml(link)}" style="color:#765618;word-break:break-all">${escapeHtml(link)}</a></p>
  <p style="font-size:13px;color:#8A7361;line-height:1.5">${escapeHtml(footnote)}</p>
</div>`;
}

function inviteEmail(user: { name: string; email: string }, link: string) {
  const intro = `An account has been created for you on the ${APP_NAME} workspace. Your username is ${user.email}.`;
  const footnote = 'This link expires in 3 days and can be used once. If it expires, ask your administrator to resend the invitation.';
  return {
    to: user.email,
    subject: `Set up your ${APP_NAME} account`,
    text: `Hello ${user.name},\n\n${intro}\n\nSet your password here:\n${link}\n\n${footnote}`,
    html: layout(`Welcome, ${user.name}`, [intro, 'Choose a password to activate your account.'], link, 'Set my password', footnote),
  };
}

function resetEmail(user: { name: string; email: string }, link: string) {
  const intro = `We received a request to reset the password for your ${APP_NAME} account (${user.email}).`;
  const footnote = "This link expires in 1 hour and can be used once. If you didn't ask for a reset, you can ignore this email — your password won't change.";
  return {
    to: user.email,
    subject: `Reset your ${APP_NAME} password`,
    text: `Hello ${user.name},\n\n${intro}\n\nChoose a new password here:\n${link}\n\n${footnote}`,
    html: layout(`Hello ${user.name}`, [intro], link, 'Reset my password', footnote),
  };
}

export type TokenLookup =
  | { ok: true; tokenId: string; userId: string; purpose: PasswordTokenPurpose; email: string; name: string }
  | { ok: false; reason: 'invalid' | 'expired' | 'used' };

/** Finds the link's token and checks that it can still be used. */
export async function lookupPasswordToken(rawToken: string): Promise<TokenLookup> {
  if (!rawToken) return { ok: false, reason: 'invalid' };
  const token = await prisma.passwordToken.findUnique({
    where: { tokenHash: await sha256Hex(rawToken) },
    include: { user: { select: { email: true, name: true, status: true } } },
  });
  if (!token || token.user.status !== 'ACTIVE') return { ok: false, reason: 'invalid' };
  if (token.usedAt) return { ok: false, reason: 'used' };
  if (token.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' };
  return { ok: true, tokenId: token.id, userId: token.userId, purpose: token.purpose, email: token.user.email, name: token.user.name };
}

/**
 * Sets the new password, spends every outstanding link for the user and signs
 * them out everywhere, so an old session or a leaked earlier link can't be reused.
 */
export async function consumePasswordToken(tokenId: string, userId: string, password: string): Promise<boolean> {
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    // Claim the token atomically so two simultaneous submissions can't both succeed.
    const claimed = await tx.passwordToken.updateMany({ where: { id: tokenId, usedAt: null }, data: { usedAt: now } });
    if (claimed.count === 0) return false;
    await tx.passwordToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
    await tx.user.update({ where: { id: userId }, data: { passwordHash, sessionVersion: { increment: 1 } } });
    const sessions = await tx.activeSession.findMany({ where: { userId, revokedAt: null }, select: { id: true } });
    const sessionIds = sessions.map((s) => s.id);
    await tx.activeSession.updateMany({ where: { id: { in: sessionIds } }, data: { revokedAt: now } });
    await tx.refreshToken.updateMany({ where: { sessionId: { in: sessionIds }, revokedAt: null }, data: { revokedAt: now } });
    return true;
  });
}

