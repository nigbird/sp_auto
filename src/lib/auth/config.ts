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

export function getTrustedOrigin(): string {
  const origin = process.env.APP_ORIGIN;
  if (!origin) {
    throw new Error('APP_ORIGIN environment variable is not set');
  }
  return origin;
}

// Static role -> permission mapping (this app has no per-portal permission model).
const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMINISTRATOR: ['plan:manage', 'activity:manage', 'activity:approve', 'user:manage', 'settings:manage', 'report:view'],
  MANAGER: ['activity:manage', 'activity:approve', 'report:view'],
  USER: ['activity:update-own', 'report:view'],
};

export function permissionsForRole(role: string): string[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
