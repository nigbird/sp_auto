import type { NextResponse } from 'next/server';
import { ACCESS_COOKIE_NAME, ACCESS_TOKEN_TTL_SECONDS, REFRESH_COOKIE_NAME, REFRESH_TOKEN_TTL_SECONDS } from './config';
import { encryptForCookie } from './crypto';

const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function setAuthCookies(
  response: NextResponse,
  params: { accessJwt: string; refreshOpaqueToken: string }
): Promise<void> {
  const encryptedAccess = await encryptForCookie(params.accessJwt);

  response.cookies.set(ACCESS_COOKIE_NAME, encryptedAccess, {
    ...baseCookieOptions,
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });

  response.cookies.set(REFRESH_COOKIE_NAME, params.refreshOpaqueToken, {
    ...baseCookieOptions,
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_COOKIE_NAME, '', { ...baseCookieOptions, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE_NAME, '', { ...baseCookieOptions, maxAge: 0 });
}
