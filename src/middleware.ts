import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from '@/lib/auth/config';
import { decryptFromCookie } from '@/lib/auth/crypto';
import { verifyAccessToken, type AccessTokenClaims } from '@/lib/auth/jwt';
import { requiredPermissions, satisfies } from '@/lib/auth/route-permissions';

// Pages anyone may open without signing in. They still get the CSP below.
const PUBLIC_PAGES = ['/login', '/forgot-password', '/set-password'];

const isDev = process.env.NODE_ENV !== 'production';

/**
 * The Content-Security-Policy for one page response. Scripts run only with this
 * request's nonce (Next.js adds it to its own <script> tags when it sees the
 * policy on the request), and everything else must come from this origin.
 * Styles keep 'unsafe-inline': Radix and Recharts position and colour elements
 * through style="" attributes, which a nonce cannot cover.
 */
function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    // 'unsafe-eval' only for React's development build (fast refresh, error overlay).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self'${isDev ? ' data: blob:' : ''}`,
    "font-src 'self'",
    `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
    "media-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

function isPublicPage(pathname: string): boolean {
  return PUBLIC_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));
}

// Edge-safe auth check only: decrypts + verifies the access-token cookie's signature
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
  const { pathname } = request.nextUrl;
  // API responses aren't HTML documents; the evidence download sets its own, stricter policy.
  const csp = pathname.startsWith('/api/') ? null : contentSecurityPolicy(btoa(crypto.randomUUID()));

  const requestHeaders = new Headers(request.headers);
  if (csp) requestHeaders.set('content-security-policy', csp);
  // For audit entries about refused pages (src/lib/auth/audit.ts). Always overwritten or
  // removed here, so a client can't supply its own.
  requestHeaders.set('x-request-path', pathname);
  requestHeaders.delete('x-denied-permissions');

  if (isPublicPage(pathname)) return withCsp(NextResponse.next({ request: { headers: requestHeaders } }), csp);

  let claims = await claimsFromCookie(request.cookies.get(ACCESS_COOKIE_NAME)?.value);
  let refreshed: Refreshed | null = null;
  const canRefresh = request.cookies.has(REFRESH_COOKIE_NAME);

  if (!claims && canRefresh) {
    refreshed = await refreshInline(request, requestHeaders);
    claims = refreshed?.claims ?? null;
  }
  if (!claims) return withCsp(redirectToLogin(request), csp);

  // Forced browsing to a page the role can't open gets a real 403 here. The
  // token's permissions can be up to one access-token lifetime old, so before
  // refusing, a token that predates a role change is refreshed and checked again.
  //
  // Page loads only. Server actions are posted to whatever page the browser is
  // on (the shared header polls notifications even on the "no access" page) and
  // each one checks its own permission, so they always go through. Rewriting
  // them to /access-denied would also make Next forward the action back to its
  // own page, here, in an endless loop.
  const isPageLoad = (request.method === 'GET' || request.method === 'HEAD') && !request.headers.has('next-action');
  const need = isPageLoad ? requiredPermissions(pathname) : null;
  if (need && !satisfies(claims.permissions, need)) {
    if (!refreshed && canRefresh) {
      refreshed = await refreshInline(request, requestHeaders);
      if (refreshed) claims = refreshed.claims;
    }
    if (!satisfies(claims.permissions, need)) {
      requestHeaders.set('x-denied-permissions', need.flat().join(','));
      const denied = NextResponse.rewrite(new URL('/access-denied', request.url), { status: 403, request: { headers: requestHeaders } });
      for (const setCookie of refreshed?.setCookies ?? []) denied.headers.append('set-cookie', setCookie);
      return withCsp(denied, csp);
    }
  }

  return withCsp(refreshed?.response ?? NextResponse.next({ request: { headers: requestHeaders } }), csp);
}

async function claimsFromCookie(cookieValue: string | undefined): Promise<AccessTokenClaims | null> {
  const jwt = cookieValue ? await decryptFromCookie(cookieValue) : null;
  return jwt ? verifyAccessToken(jwt) : null;
}

function withCsp(response: NextResponse, csp: string | null): NextResponse {
  if (csp) response.headers.set('Content-Security-Policy', csp);
  return response;
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

type Refreshed = { response: NextResponse; setCookies: string[]; claims: AccessTokenClaims };

/**
 * Calls the refresh route handler (Node runtime, has DB access) on the user's
 * behalf. On success, the new cookies are forwarded both to the browser (Set-Cookie)
 * and to this same request's downstream handlers (Cookie header), so the page
 * or server action being requested renders as the signed-in user. The new
 * access token carries the role's current permissions.
 */
async function refreshInline(request: NextRequest, requestHeaders: Headers): Promise<Refreshed | null> {
  let refreshResponse: Response;
  try {
    const refreshUrl = new URL('/api/auth/refresh', request.nextUrl.origin);
    // The refresh route rejects requests without a same-origin Origin header (CSRF).
    const forwardedHeaders = new Headers({ cookie: request.headers.get('cookie') ?? '', origin: refreshUrl.origin });
    for (const name of ['user-agent', 'x-forwarded-for', 'x-real-ip']) {
      const value = request.headers.get(name);
      if (value) forwardedHeaders.set(name, value);
    }
    refreshResponse = await fetch(refreshUrl, {
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

  const claims = await claimsFromCookie(requestCookies.get(ACCESS_COOKIE_NAME));
  if (!claims) return null;

  requestHeaders.set(
    'cookie',
    Array.from(requestCookies, ([name, value]) => `${name}=${value}`).join('; ')
  );

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const setCookie of setCookies) response.headers.append('set-cookie', setCookie);
  return { response, setCookies, claims };
}

export const config = {
  // Everything except the sign-in API (it handles its own auth) and static files.
  matcher: ['/((?!api/auth/|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?)$).*)'],
};
