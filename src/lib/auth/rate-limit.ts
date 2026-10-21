import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import {
  IDENTIFIER_LOCKOUT_MAX_ATTEMPTS,
  IDENTIFIER_LOCKOUT_WINDOW_SECONDS,
  IP_LOCKOUT_MAX_ATTEMPTS,
  IP_LOCKOUT_WINDOW_SECONDS,
} from './config';

async function countFailures(where: { identifier?: string; ip?: string }, windowSeconds: number): Promise<number> {
  const since = new Date(Date.now() - windowSeconds * 1000);
  return prisma.auditLog.count({
    where: {
      action: 'LOGIN_FAILURE',
      success: false,
      createdAt: { gte: since },
      ...where,
    },
  });
}

/**
 * What a sign-in attempt is logged (and locked out) under. Anything that isn't
 * an email address is stored only as a hash, because people sometimes type
 * their password into the email box and it must never be saved as typed.
 */
export function loginIdentifierForLog(identifier: string): string {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) return identifier;
  return `hash:${createHash('sha256').update(identifier).digest('hex').slice(0, 32)}`;
}

export async function isIdentifierLocked(identifier: string): Promise<boolean> {
  const failures = await countFailures({ identifier }, IDENTIFIER_LOCKOUT_WINDOW_SECONDS);
  return failures >= IDENTIFIER_LOCKOUT_MAX_ATTEMPTS;
}

export async function isIpLocked(ip: string): Promise<boolean> {
  if (!ip || ip === 'unknown') return false;
  const failures = await countFailures({ ip }, IP_LOCKOUT_WINDOW_SECONDS);
  return failures >= IP_LOCKOUT_MAX_ATTEMPTS;
}

export function getRequestIp(request: Request): string {
  return ipFromHeaders(request.headers);
}

function trustedProxyCount(): number {
  const count = Number(process.env.TRUSTED_PROXY_COUNT);
  return Number.isInteger(count) && count >= 1 ? count : 1;
}

/**
 * Same as getRequestIp, for server actions (which only have `headers()`).
 *
 * X-Forwarded-For is a list each proxy appends to, so only its right-hand end
 * is written by infrastructure we run; the left-most entry is whatever the
 * client sent and could be changed on every request to dodge the per-IP
 * lockout. TRUSTED_PROXY_COUNT (default 1) is how many of our own proxies sit
 * in front of the app: the client is that many places from the right.
 */
export function ipFromHeaders(headers: Pick<Headers, 'get'>): string {
  const forwardedFor = headers.get('x-forwarded-for');
  const chain = forwardedFor ? forwardedFor.split(',').map((ip) => ip.trim()).filter(Boolean) : [];
  if (chain.length > 0) return chain[Math.max(0, chain.length - trustedProxyCount())]!;
  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}
