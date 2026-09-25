export const ACCESS_TOKEN_TTL_SECONDS = 5 * 60; // 5 minutes
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

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
