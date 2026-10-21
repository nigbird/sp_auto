import type { NextResponse } from 'next/server';
import { ACCESS_COOKIE_NAME, ACCESS_TOKEN_TTL_SECONDS, REFRESH_COOKIE_NAME, REFRESH_TOKEN_TTL_SECONDS } from './config';
import { encryptForCookie } from './crypto';

// SameSite=Strict: neither cookie is sent on any cross-site request, including
// top-level navigations. Someone arriving from a link in an email therefore
// lands on /login first, which recovers the session itself (see login/page.tsx).
const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

export async function setAuthCookies(
  response: NextResponse,
  params: { accessJwt: string; refreshOpaqueToken: string | null }
): Promise<void> {
  const encryptedAccess = await encryptForCookie(params.accessJwt);

  response.cookies.set(ACCESS_COOKIE_NAME, encryptedAccess, {
    ...baseCookieOptions,
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });

  // Null on the concurrent-refresh grace path: the browser already holds the
  // newer refresh cookie, so don't overwrite it.
  if (params.refreshOpaqueToken) {
    response.cookies.set(REFRESH_COOKIE_NAME, params.refreshOpaqueToken, {
      ...baseCookieOptions,
      maxAge: REFRESH_TOKEN_TTL_SECONDS,
    });
  }
}

type CookieWriter = { set(name: string, value: string, options: typeof baseCookieOptions & { maxAge: number }): unknown };

/**
 * Expires both auth cookies on a route-handler response or, from a server
 * action, on `await cookies()`. Uses the same attributes they were set with:
 * browsers ignore a deletion of a __Host- cookie that isn't Secure with Path=/.
 */
export function clearAuthCookies(target: NextResponse | CookieWriter): void {
  const jar: CookieWriter = 'cookies' in target ? target.cookies : target;
  jar.set(ACCESS_COOKIE_NAME, '', { ...baseCookieOptions, maxAge: 0 });
  jar.set(REFRESH_COOKIE_NAME, '', { ...baseCookieOptions, maxAge: 0 });
}
