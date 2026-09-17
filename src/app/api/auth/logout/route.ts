import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from '@/lib/auth/config';
import { decryptFromCookie } from '@/lib/auth/crypto';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { findSessionIdForRefreshToken, revokeSessionById } from '@/lib/auth/issue';
import { clearAuthCookies } from '@/lib/auth/cookies';
import { writeAuditLog } from '@/lib/auth/audit';
import { getRequestIp } from '@/lib/auth/rate-limit';

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const userAgent = request.headers.get('user-agent') ?? undefined;

  let sessionId: string | null = null;
  let userId: string | null = null;

  const accessCookie = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  if (accessCookie) {
    const jwt = await decryptFromCookie(accessCookie);
    const claims = jwt ? await verifyAccessToken(jwt) : null;
    if (claims) {
      sessionId = claims.sid;
      userId = claims.sub;
    }
  }

  if (!sessionId) {
    const refreshCookie = request.cookies.get(REFRESH_COOKIE_NAME)?.value;
    if (refreshCookie) sessionId = await findSessionIdForRefreshToken(refreshCookie);
  }

  if (sessionId) {
    await revokeSessionById(sessionId);
  }

  await writeAuditLog({ action: 'LOGOUT', success: true, userId, ip, userAgent });

  const response = NextResponse.json({ success: true });
  clearAuthCookies(response);
  return response;
}
