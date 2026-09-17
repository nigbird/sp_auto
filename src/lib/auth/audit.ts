import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export type AuditAction = 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'LOGOUT' | 'TOKEN_REFRESH' | 'SESSION_REVOKED';

export async function writeAuditLog(params: {
  action: AuditAction;
  success: boolean;
  identifier?: string | null;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: params.action,
      success: params.success,
      identifier: params.identifier ?? null,
      userId: params.userId ?? null,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
