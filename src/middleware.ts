import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE_NAME } from '@/lib/auth/config';
import { decryptFromCookie } from '@/lib/auth/crypto';
import { verifyAccessToken } from '@/lib/auth/jwt';

// Edge-safe check only: decrypts + verifies the access-token cookie's signature
// and expiry. It cannot reach Prisma (Edge runtime), so it can't see a session
// that was revoked server-side (forced logout, concurrent-session eviction) —
// that DB-backed check happens in requireUser()/getCurrentUser() (src/lib/auth/session.ts)
// on every server action and route handler that actually touches data.
export async function middleware(request: NextRequest) {
  const cookieValue = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  const jwt = cookieValue ? await decryptFromCookie(cookieValue) : null;
  const claims = jwt ? await verifyAccessToken(jwt) : null;

  if (!claims) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|login).*)'],
};
