import { prisma } from '@/lib/prisma';
import { CONCURRENT_SESSION_LIMIT, REFRESH_TOKEN_TTL_SECONDS } from './config';
import { generateOpaqueToken, sha256Hex, generateId } from './crypto';
import { signAccessToken } from './jwt';
import { getPermissionsForRole } from './permissions-server';

export interface IssuedTokens {
  accessJwt: string;
  /** Null when only a fresh access token was issued (concurrent-refresh grace path) — keep the current refresh cookie. */
  refreshOpaqueToken: string | null;
  sessionId: string;
}

/**
 * A refresh token rotated this recently is treated as a benign race (two tabs
 * or parallel requests refreshing at the same moment), not as theft. The loser
 * of the race gets a fresh access token for the same session but no new
 * refresh token — the browser already holds the winner's refresh cookie.
 */
const ROTATION_GRACE_MS = 60_000;

class RotationRaceError extends Error {}

/**
 * Starts a brand-new session for a just-authenticated user: evicts the oldest
 * active session(s) beyond the concurrency limit, creates the ActiveSession +
 * first RefreshToken (new rotation family) row, and signs the access JWT.
 */
export async function createSessionWithTokens(params: {
  userId: string;
  role: string;
  roleId: string;
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

  const permissions = await getPermissionsForRole(params.roleId);
  const accessJwt = await signAccessToken({
    userId: params.userId,
    sessionId,
    role: params.role,
    roleId: params.roleId,
    permissions,
    sessionVersion: params.sessionVersion,
  });

  return { accessJwt, refreshOpaqueToken: rawRefreshToken, sessionId };
}

export type RotateResult = { ok: true; tokens: IssuedTokens } | { ok: false; reason: 'invalid' | 'reused' };

function findRefreshTokenWithSession(tokenHash: string) {
  return prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { session: { include: { user: { include: { role: true } } } } },
  });
}

type RefreshTokenWithSession = NonNullable<Awaited<ReturnType<typeof findRefreshTokenWithSession>>>;
type SessionWithUser = RefreshTokenWithSession['session'];

function isLiveSession(session: SessionWithUser | null): session is SessionWithUser {
  return !!session && !session.revokedAt && session.user.status === 'ACTIVE';
}

function isWithinRotationGrace(token: RefreshTokenWithSession): boolean {
  return (
    !!token.revokedAt &&
    !!token.replacedById &&
    token.expiresAt > new Date() &&
    Date.now() - token.revokedAt.getTime() < ROTATION_GRACE_MS
  );
}

async function signAccessTokenForSession(session: SessionWithUser): Promise<string> {
  const permissions = await getPermissionsForRole(session.user.roleId);
  return signAccessToken({
    userId: session.userId,
    sessionId: session.id,
    role: session.user.role.name,
    roleId: session.user.roleId,
    permissions,
    sessionVersion: session.user.sessionVersion,
  });
}

/** Grace-path result: a new access token for the same session, keeping whatever refresh cookie the browser now holds. */
async function issueAccessOnly(token: RefreshTokenWithSession): Promise<RotateResult> {
  if (!isLiveSession(token.session)) return { ok: false, reason: 'invalid' };
  const accessJwt = await signAccessTokenForSession(token.session);
  return { ok: true, tokens: { accessJwt, refreshOpaqueToken: null, sessionId: token.session.id } };
}

/**
 * Rotates a refresh token: the presented raw token must match a live, unexpired
 * RefreshToken row. A token rotated within ROTATION_GRACE_MS is a concurrent
 * refresh and only gets a new access token. Any other revoked/expired match is
 * a reuse signal (the token was stolen and used after the legitimate rotation) —
 * the entire rotation family and its session are revoked.
 */
export async function rotateRefreshToken(rawRefreshToken: string): Promise<RotateResult> {
  const tokenHash = await sha256Hex(rawRefreshToken);
  const existing = await findRefreshTokenWithSession(tokenHash);

  if (!existing) return { ok: false, reason: 'invalid' };

  if (isWithinRotationGrace(existing)) return issueAccessOnly(existing);

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
  if (!isLiveSession(session)) {
    return { ok: false, reason: 'invalid' };
  }

  const newRawToken = generateOpaqueToken();
  const newTokenHash = await sha256Hex(newRawToken);

  try {
    await prisma.$transaction(async (tx) => {
      const newToken = await tx.refreshToken.create({
        data: {
          sessionId: session.id,
          tokenHash: newTokenHash,
          familyId: existing.familyId,
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
        },
      });
      // Conditional on the token still being live, so two requests that both
      // read it as unrevoked can't both rotate it — the loser rolls back.
      const { count } = await tx.refreshToken.updateMany({
        where: { id: existing.id, revokedAt: null },
        data: { revokedAt: new Date(), replacedById: newToken.id },
      });
      if (count === 0) throw new RotationRaceError();
      await tx.activeSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    });
  } catch (error) {
    if (error instanceof RotationRaceError) return issueAccessOnly(existing);
    throw error;
  }

  const accessJwt = await signAccessTokenForSession(session);

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
