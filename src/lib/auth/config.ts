const DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES = 30;
const MIN_SESSION_IDLE_TIMEOUT_MINUTES = 2;

function readIdleTimeoutMinutes(): number {
  const raw = process.env.SESSION_IDLE_TIMEOUT_MINUTES;
  const minutes = raw ? Number(raw) : NaN;
  if (!Number.isFinite(minutes) || minutes <= 0) return DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES;
  return Math.max(minutes, MIN_SESSION_IDLE_TIMEOUT_MINUTES);
}

/**
 * Inactivity timeout, from SESSION_IDLE_TIMEOUT_MINUTES in .env (default 30).
 * It's a sliding window: every token refresh — which happens whenever the user
 * is actively using the app — pushes it forward again, so an active user is
 * never logged out; only a session left untouched this long expires.
 */
export const SESSION_IDLE_TIMEOUT_SECONDS = Math.round(readIdleTimeoutMinutes() * 60);

// The refresh token *is* the idle window: it's re-issued with a fresh expiry on every rotation.
export const REFRESH_TOKEN_TTL_SECONDS = SESSION_IDLE_TIMEOUT_SECONDS;
// Short-lived by design (5 min), never longer than the idle window itself.
export const ACCESS_TOKEN_TTL_SECONDS = Math.min(5 * 60, SESSION_IDLE_TIMEOUT_SECONDS);

export const ACCESS_COOKIE_NAME = 'access_token';
export const REFRESH_COOKIE_NAME = 'refresh_token';

export const CONCURRENT_SESSION_LIMIT = 1;

// Lockout thresholds — counted against AuditLog rows within the trailing window.
export const IDENTIFIER_LOCKOUT_WINDOW_SECONDS = 15 * 60;
export const IDENTIFIER_LOCKOUT_MAX_ATTEMPTS = 5;

export const IP_LOCKOUT_WINDOW_SECONDS = 15 * 60;
export const IP_LOCKOUT_MAX_ATTEMPTS = 20;

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET environment variable is not set');
  }
  return secret;
}

/** Optional extra allowlisted origin (e.g. a production domain behind a proxy). Same-origin requests are always trusted regardless — see origin.ts. */
export function getTrustedOrigin(): string | null {
  return process.env.APP_ORIGIN || null;
}

// Role -> permission lookup is DB-backed (RolePermission table) so an admin
// editing permissions via /users/roles takes effect immediately —
// see getPermissionsForRole in src/lib/auth/permissions.ts.
