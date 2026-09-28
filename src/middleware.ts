import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from '@/lib/auth/config';
import { decryptFromCookie } from '@/lib/auth/crypto';
import { verifyAccessToken } from '@/lib/auth/jwt';

// Edge-safe check only: decrypts + verifies the access-token cookie's signature
// and expiry. It cannot reach Prisma (Edge runtime), so it can't see a session
// that was revoked server-side (forced logout, concurrent-session eviction) —
// that DB-backed check happens in requireUser()/getCurrentUser() (src/lib/auth/session.ts)
// on every server action and route handler that actually touches data.
//
// The access token only lives 5 minutes and the client keep-alive timer can be
// throttled or frozen (background tab, sleeping laptop), so an expired access
// token alongside a refresh cookie is refreshed here, transparently, instead of
// bouncing the user to /login on their next click.
export async function middleware(request: NextRequest) {
  const cookieValue = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  const jwt = cookieValue ? await decryptFromCookie(cookieValue) : null;
  const claims = jwt ? await verifyAccessToken(jwt) : null;

  if (claims) return NextResponse.next();

  if (request.cookies.has(REFRESH_COOKIE_NAME)) {
    const refreshed = await refreshInline(request);
    if (refreshed) return refreshed;
  }

  return redirectToLogin(request);
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

/**
 * Calls the refresh route handler (Node runtime, has DB access) on the user's
 * behalf. On success, the new cookies are forwarded both to the browser (Set-Cookie)
 * and to this same request's downstream handlers (Cookie header), so the page
 * or server action being requested renders as the signed-in user.
 */
async function refreshInline(request: NextRequest): Promise<NextResponse | null> {
  let refreshResponse: Response;
  try {
    const forwardedHeaders = new Headers({ cookie: request.headers.get('cookie') ?? '' });
    for (const name of ['user-agent', 'x-forwarded-for', 'x-real-ip']) {
      const value = request.headers.get(name);
      if (value) forwardedHeaders.set(name, value);
    }
    refreshResponse = await fetch(new URL('/api/auth/refresh', request.nextUrl.origin), {
      method: 'POST',
      headers: forwardedHeaders,
      cache: 'no-store',
    });
  } catch {
    return null;
  }

  if (!refreshResponse.ok) return null;

  const setCookies = refreshResponse.headers.getSetCookie();
  const requestCookies = new Map(request.cookies.getAll().map((c) => [c.name, c.value]));
  for (const setCookie of setCookies) {
    const pair = setCookie.split(';', 1)[0]!;
    const eq = pair.indexOf('=');
    if (eq > 0) requestCookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    'cookie',
    Array.from(requestCookies, ([name, value]) => `${name}=${value}`).join('; ')
  );

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const setCookie of setCookies) response.headers.append('set-cookie', setCookie);
  return response;
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|login|forgot-password|set-password).*)'],
};
