import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import type { AuditAction } from '@/lib/audit-actions';
import { getCurrentUser } from './session';
import { ipFromHeaders } from './rate-limit';

export type { AuditAction } from '@/lib/audit-actions';

export type AuditEntityType =
  | 'User'
  | 'Role'
  | 'StrategicPlan'
  | 'Activity'
  | 'Deliverable'
  | 'ReportingPeriod'
  | 'ReportEntry'
  | 'Evidence'
  | 'Rule'
  | 'AppConfig'
  | 'Department'
  | 'LeadOwner'
  | 'AuditLog';

export async function writeAuditLog(params: {
  action: AuditAction;
  success: boolean;
  identifier?: string | null;
  userId?: string | null;
  actorId?: string | null;
  entityType?: AuditEntityType | null;
  entityId?: string | null;
  summary?: string | null;
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
      actorId: params.actorId ?? null,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      summary: params.summary ?? null,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

const comparable = (v: unknown) => (v instanceof Date ? v.toISOString() : v === undefined ? null : v);

/**
 * The fields of `next` whose value differs from `before`, as { field: { from, to } },
 * for an audit entry's metadata. Fields missing from `next` aren't compared.
 */
export function changedFields(before: object, next: object): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) continue;
    const from = comparable((before as Record<string, unknown>)[key]);
    const to = comparable(value);
    if (JSON.stringify(from) !== JSON.stringify(to)) out[key] = { from, to };
  }
  return out;
}

/**
 * Records an important action taken by the signed-in user, from a server
 * action or route handler. The actor, IP and browser come from the current
 * request. Best-effort: a failure to write the entry is logged and never
 * undoes or blocks the action that already happened.
 */
export async function recordAudit(event: {
  action: AuditAction;
  summary: string;
  entityType?: AuditEntityType;
  entityId?: string | null;
  /** The user the action was about, when that's a person (e.g. the account deactivated). */
  userId?: string | null;
  identifier?: string | null;
  success?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const [actor, h] = await Promise.all([getCurrentUser(), headers()]);
    await writeAuditLog({
      action: event.action,
      success: event.success ?? true,
      summary: event.summary,
      entityType: event.entityType ?? null,
      entityId: event.entityId ?? null,
      userId: event.userId ?? null,
      identifier: event.identifier ?? actor?.email ?? null,
      actorId: actor?.id ?? null,
      ip: ipFromHeaders(h),
      userAgent: h.get('user-agent'),
      metadata: event.metadata,
    });
  } catch (error) {
    console.error(`Audit: could not record ${event.action}`, error);
  }
}
