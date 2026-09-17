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
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0]!.trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}
