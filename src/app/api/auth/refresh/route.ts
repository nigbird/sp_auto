import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_COOKIE_NAME } from '@/lib/auth/config';
import { rotateRefreshToken } from '@/lib/auth/issue';
import { clearAuthCookies, setAuthCookies } from '@/lib/auth/cookies';
import { writeAuditLog } from '@/lib/auth/audit';
import { getRequestIp } from '@/lib/auth/rate-limit';

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const userAgent = request.headers.get('user-agent') ?? undefined;
  const rawRefreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (!rawRefreshToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const result = await rotateRefreshToken(rawRefreshToken);

  if (!result.ok) {
    await writeAuditLog({ action: 'TOKEN_REFRESH', success: false, ip, userAgent, metadata: { reason: result.reason } });
    const response = NextResponse.json({ error: 'Session expired' }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }

  await writeAuditLog({ action: 'TOKEN_REFRESH', success: true, ip, userAgent });

  const response = NextResponse.json({ expiresIn: ACCESS_TOKEN_TTL_SECONDS });
  await setAuthCookies(response, {
    accessJwt: result.tokens.accessJwt,
    refreshOpaqueToken: result.tokens.refreshOpaqueToken,
  });
  return response;
}
