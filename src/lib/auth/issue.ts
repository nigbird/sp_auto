import { prisma } from '@/lib/prisma';
import { CONCURRENT_SESSION_LIMIT, REFRESH_TOKEN_TTL_SECONDS } from './config';
import { generateOpaqueToken, sha256Hex, generateId } from './crypto';
import { signAccessToken } from './jwt';

export interface IssuedTokens {
  accessJwt: string;
  refreshOpaqueToken: string;
  sessionId: string;
}

/**
 * Starts a brand-new session for a just-authenticated user: evicts the oldest
 * active session(s) beyond the concurrency limit, creates the ActiveSession +
 * first RefreshToken (new rotation family) row, and signs the access JWT.
 */
export async function createSessionWithTokens(params: {
  userId: string;
  role: string;
  sessionVersion: number;
  ip: string;
  userAgent: string;
}): Promise<IssuedTokens> {
  const familyId = generateId();
  const rawRefreshToken = generateOpaqueToken();
  const refreshTokenHash = await sha256Hex(rawRefreshToken);

  const sessionId = await prisma.$transaction(async (tx) => {
    const activeSessions = await tx.activeSession.findMany({
      where: { userId: params.userId, revokedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    if (activeSessions.length >= CONCURRENT_SESSION_LIMIT) {
      const evictCount = activeSessions.length - CONCURRENT_SESSION_LIMIT + 1;
      const evictIds = activeSessions.slice(0, evictCount).map((s) => s.id);
      await tx.activeSession.updateMany({ where: { id: { in: evictIds } }, data: { revokedAt: new Date() } });
      await tx.refreshToken.updateMany({
        where: { sessionId: { in: evictIds }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    const session = await tx.activeSession.create({
      data: { userId: params.userId, ip: params.ip, userAgent: params.userAgent },
    });

    await tx.refreshToken.create({
      data: {
        sessionId: session.id,
        tokenHash: refreshTokenHash,
        familyId,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      },
    });

    return session.id;
  });

  const accessJwt = await signAccessToken({
    userId: params.userId,
    sessionId,
    role: params.role,
    sessionVersion: params.sessionVersion,
  });

  return { accessJwt, refreshOpaqueToken: rawRefreshToken, sessionId };
}

export type RotateResult = { ok: true; tokens: IssuedTokens } | { ok: false; reason: 'invalid' | 'reused' };

/**
 * Rotates a refresh token: the presented raw token must match a live, unexpired
 * RefreshToken row. If it matches a row that's already revoked/expired, that's a
 * reuse signal (the token was stolen and used after the legitimate rotation) —
 * the entire rotation family and its session are revoked.
 */
export async function rotateRefreshToken(rawRefreshToken: string): Promise<RotateResult> {
  const tokenHash = await sha256Hex(rawRefreshToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { session: { include: { user: true } } },
  });

  if (!existing) return { ok: false, reason: 'invalid' };

  if (existing.revokedAt || existing.expiresAt < new Date()) {
    await prisma.$transaction([
      prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.activeSession.update({ where: { id: existing.sessionId }, data: { revokedAt: new Date() } }),
    ]);
    return { ok: false, reason: 'reused' };
  }

  const session = existing.session;
  if (!session || session.revokedAt || session.user.status !== 'ACTIVE') {
    return { ok: false, reason: 'invalid' };
  }

  const newRawToken = generateOpaqueToken();
  const newTokenHash = await sha256Hex(newRawToken);

  await prisma.$transaction(async (tx) => {
    const newToken = await tx.refreshToken.create({
      data: {
        sessionId: session.id,
        tokenHash: newTokenHash,
        familyId: existing.familyId,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      },
    });
    await tx.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedById: newToken.id },
    });
    await tx.activeSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  });

  const accessJwt = await signAccessToken({
    userId: session.userId,
    sessionId: session.id,
    role: session.user.role,
    sessionVersion: session.user.sessionVersion,
  });

  return { ok: true, tokens: { accessJwt, refreshOpaqueToken: newRawToken, sessionId: session.id } };
}

/** Revokes a session and all of its refresh tokens (used by logout and forced-logout flows). */
export async function revokeSessionById(sessionId: string): Promise<void> {
  await prisma.$transaction([
    prisma.activeSession.update({ where: { id: sessionId }, data: { revokedAt: new Date() } }),
    prisma.refreshToken.updateMany({ where: { sessionId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

/** Looks up the session id bound to a raw refresh-token cookie value, without rotating it. */
export async function findSessionIdForRefreshToken(rawRefreshToken: string): Promise<string | null> {
  const tokenHash = await sha256Hex(rawRefreshToken);
  const token = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  return token?.sessionId ?? null;
}
