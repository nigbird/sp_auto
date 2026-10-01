'use server'

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions-server';
import { recordAudit } from '@/lib/auth/audit';
import { AUDIT_ACTIONS, AUDIT_CATEGORIES, auditActionsIn, type AuditAction, type AuditCategory } from '@/lib/audit-actions';

export interface AuditLogFilters {
    category?: AuditCategory | null;
    action?: AuditAction | null;
    actorId?: string | null;
    outcome?: 'success' | 'failure' | null;
    /** Matches the summary or email. */
    q?: string;
    /** ISO timestamps, inclusive (the page turns the picked days into the viewer's local start/end of day). */
    from?: string;
    to?: string;
}

export interface AuditLogRow {
    id: string;
    createdAt: string;
    action: string;
    success: boolean;
    summary: string | null;
    actor: { id: string; name: string; email: string } | null;
    subject: { id: string; name: string; email: string } | null;
    identifier: string | null;
    entityType: string | null;
    entityId: string | null;
    /** e.g. "Chrome on Windows". The IP address and full browser string stay in the database only. */
    device: string | null;
    metadata: unknown;
}

const MAX_PAGE_SIZE = 100;
const MAX_EXPORT_ROWS = 10_000;
/** Session refreshes happen every few minutes per user; they're only listed when asked for by name. */
const HIDDEN_BY_DEFAULT: AuditAction[] = ['TOKEN_REFRESH'];

function whereFor(filters: AuditLogFilters): Prisma.AuditLogWhereInput {
    const and: Prisma.AuditLogWhereInput[] = [];

    if (filters.action && filters.action in AUDIT_ACTIONS) {
        and.push({ action: filters.action });
    } else if (filters.category && (AUDIT_CATEGORIES as readonly string[]).includes(filters.category)) {
        and.push({ action: { in: auditActionsIn(filters.category).filter((a) => !HIDDEN_BY_DEFAULT.includes(a)) } });
    } else {
        and.push({ action: { notIn: HIDDEN_BY_DEFAULT } });
    }

    if (filters.actorId) and.push({ OR: [{ actorId: filters.actorId }, { actorId: null, userId: filters.actorId }] });
    if (filters.outcome === 'success') and.push({ success: true });
    if (filters.outcome === 'failure') and.push({ success: false });

    const q = (filters.q ?? '').trim();
    if (q) {
        and.push({
            OR: [
                { summary: { contains: q, mode: 'insensitive' } },
                { identifier: { contains: q, mode: 'insensitive' } },
                { entityId: q },
            ],
        });
    }

    const createdAt: Prisma.DateTimeFilter = {};
    const from = filters.from ? new Date(filters.from) : null;
    const to = filters.to ? new Date(filters.to) : null;
    if (from && !Number.isNaN(from.getTime())) createdAt.gte = from;
    if (to && !Number.isNaN(to.getTime())) createdAt.lte = to;
    if (createdAt.gte || createdAt.lte) and.push({ createdAt });

    return { AND: and };
}

/** A rough "Browser on OS" label; no versions or other fingerprinting detail. */
function describeDevice(userAgent: string | null): string | null {
    if (!userAgent) return null;
    const browser =
        /Edg\//.test(userAgent) ? 'Edge'
        : /OPR\/|Opera/.test(userAgent) ? 'Opera'
        : /Firefox\//.test(userAgent) ? 'Firefox'
        : /Chrome\//.test(userAgent) ? 'Chrome'
        : /Safari\//.test(userAgent) ? 'Safari'
        : null;
    const os =
        /Windows/.test(userAgent) ? 'Windows'
        : /Android/.test(userAgent) ? 'Android'
        : /iPhone|iPad|iPod/.test(userAgent) ? 'iOS'
        : /Mac OS X|Macintosh/.test(userAgent) ? 'macOS'
        : /Linux/.test(userAgent) ? 'Linux'
        : null;
    if (browser && os) return `${browser} on ${os}`;
    return browser ?? os ?? 'Other device';
}

async function toRows(logs: Awaited<ReturnType<typeof prisma.auditLog.findMany>>): Promise<AuditLogRow[]> {
    const ids = new Set<string>();
    for (const log of logs) {
        if (log.actorId) ids.add(log.actorId);
        if (log.userId) ids.add(log.userId);
    }
    const users = await prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true, email: true } });
    const byId = new Map(users.map((u) => [u.id, u]));

    return logs.map((log) => ({
        id: log.id,
        createdAt: log.createdAt.toISOString(),
        action: log.action,
        success: log.success,
        summary: log.summary,
        // Older sign-in entries only recorded the user they were about.
        actor: (log.actorId && byId.get(log.actorId)) || null,
        subject: (log.userId && byId.get(log.userId)) || null,
        // Hashed sign-in attempts (see loginIdentifierForLog) aren't shown.
        identifier: log.identifier?.startsWith('hash:') ? null : log.identifier,
        entityType: log.entityType,
        entityId: log.entityId,
        device: describeDevice(log.userAgent),
        metadata: log.metadata,
    }));
}

/** One page of the audit log, newest first. */
export async function getAuditLog(filters: AuditLogFilters, page = 1, pageSize = 25): Promise<{ rows: AuditLogRow[]; total: number }> {
    await requirePermission('audit:view');
    const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSize) || 25));
    const current = Math.max(1, Math.floor(page) || 1);
    const where = whereFor(filters);

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (current - 1) * size, take: size }),
        prisma.auditLog.count({ where }),
    ]);
    return { rows: await toRows(logs), total };
}

/** Everyone who appears as an actor, for the "Performed by" filter. */
export async function getAuditActors(): Promise<{ id: string; name: string; email: string }[]> {
    await requirePermission('audit:view');
    return prisma.user.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: 'asc' } });
}

/**
 * Every entry matching the filters (up to 10,000, newest first) for a CSV
 * download. The export itself is recorded in the audit log.
 */
export async function exportAuditLog(filters: AuditLogFilters): Promise<{ rows: AuditLogRow[]; truncated: boolean }> {
    await requirePermission('audit:export');
    const where = whereFor(filters);
    const logs = await prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: MAX_EXPORT_ROWS + 1 });
    const truncated = logs.length > MAX_EXPORT_ROWS;
    const rows = await toRows(logs.slice(0, MAX_EXPORT_ROWS));

    await recordAudit({
        action: 'AUDIT_LOG_EXPORTED', entityType: 'AuditLog',
        summary: `Exported ${rows.length} audit log entries${truncated ? ' (limit reached)' : ''}`,
        metadata: { filters: { ...filters }, rows: rows.length, truncated },
    });
    return { rows, truncated };
}
