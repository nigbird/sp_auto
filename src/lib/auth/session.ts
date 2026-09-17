import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ACCESS_COOKIE_NAME } from './config';
import { decryptFromCookie } from './crypto';
import { verifyAccessToken } from './jwt';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'ADMINISTRATOR' | 'MANAGER' | 'USER';
  status: 'ACTIVE' | 'INACTIVE';
  /**
   * UI-level hint only, sourced from the access token's embedded snapshot
   * (taken at login/refresh time) — not re-checked against the DB on every
   * render. Use it to show/hide controls; the authoritative check for any
   * actual mutation is requirePermission() (src/lib/auth/permissions.ts),
   * which reads live DB state.
   */
  permissions: string[];
}

/**
 * Resolves the current request's authenticated user, if any.
 * Verifies the access-token cookie's signature/expiry *and* cross-checks the
 * live ActiveSession + user.sessionVersion in the DB, so a revoked session or
 * a stale token (from before a forced logout) is rejected even if the JWT
 * itself hasn't expired yet.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  if (!cookieValue) return null;

  const jwt = await decryptFromCookie(cookieValue);
  if (!jwt) return null;

  const claims = await verifyAccessToken(jwt);
  if (!claims) return null;

  const session = await prisma.activeSession.findUnique({
    where: { id: claims.sid },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.userId !== claims.sub) return null;
  if (session.user.status !== 'ACTIVE') return null;
  if (session.user.sessionVersion !== claims.sessionVersion) return null;

  // Best-effort activity heartbeat; not critical to the auth decision itself.
  prisma.activeSession
    .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    .catch(() => {});

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    avatar: session.user.avatar,
    role: session.user.role,
    status: session.user.status,
    permissions: claims.permissions ?? [],
  };
}

/**
 * Use at the top of server actions and page-rendering server components that
 * require a logged-in user. The access-token JWT can still look valid (it
 * hasn't expired yet) even after a forced logout or a concurrent-session
 * eviction, since that revocation only lives in the DB — this is what catches
 * that case. Redirects to /login rather than throwing, since middleware's
 * edge-only check already let the request through and can't see that DB state.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}
