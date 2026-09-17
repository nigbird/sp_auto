import type { NextRequest } from 'next/server';
import { getTrustedOrigin } from './config';

/**
 * A request's Origin (or Referer) is trusted if it matches the request's own
 * Host header — i.e. it's a same-origin request — or, as a secondary
 * allowlist, the configured APP_ORIGIN (useful in production behind a proxy
 * where the public origin may differ from what Host reports). Comparing
 * against the request's own host means this keeps working regardless of
 * which port `next dev`/`next start` happens to bind to, instead of needing
 * APP_ORIGIN kept in lockstep with it.
 */
export function originIsTrusted(request: NextRequest): boolean {
  const host = request.headers.get('host');
  const selfOrigin = host ? `${request.nextUrl.protocol}//${host}` : null;
  const configuredOrigin = getTrustedOrigin();

  const isAllowed = (candidate: string) => candidate === selfOrigin || candidate === configuredOrigin;

  const origin = request.headers.get('origin');
  if (origin) return isAllowed(origin);

  const referer = request.headers.get('referer');
  if (referer) {
    try {
      return isAllowed(new URL(referer).origin);
    } catch {
      return false;
    }
  }

  return false;
}
