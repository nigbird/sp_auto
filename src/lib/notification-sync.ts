// Deliberately a plain module (no 'use server') even though its only callers
// are a server action (src/actions/notifications.ts) and instrumentation.ts's
// background timer — a 'use server' file gets special webpack bundling for the
// Server Actions RPC mechanism that pulled Prisma and friends into the Edge
// middleware bundle when instrumentation.ts dynamically imported it (confirmed
// by removing instrumentation.ts and watching the middleware bundle shrink back
// down). Keeping the real logic here, with no 'use server' directive, avoids that.
import { prisma } from '@/lib/prisma';
import { calculateActivityStatus, calculateDelayDays } from '@/lib/utils';
import { isCutOffPassed } from '@/lib/reporting-period';
import { isWithinDeadlineWindow, type NotificationType } from '@/lib/notifications';

type PendingNotification = {
    type: NotificationType;
    userId: string;
    message: string;
    activityId?: string;
    reportingPeriodId?: string;
};

const SYNCED_TYPES: NotificationType[] = ['DEADLINE_APPROACHING', 'ACTIVITY_DELAYED', 'EVIDENCE_MISSING', 'PERIOD_CLOSED'];

const dedupeKey = (n: { type: string; userId: string; activityId?: string | null; reportingPeriodId?: string | null }) =>
    `${n.type}|${n.userId}|${n.activityId ?? ''}|${n.reportingPeriodId ?? ''}`;

// Guards against the background timer and a bell-open sync overlapping in the
// same process, which would otherwise both see a notification as missing.
let inFlight: Promise<void> | null = null;

/**
 * Evaluates time-based notification conditions (deadline approaching, delayed,
 * evidence missing, a period's cut-off silently passing) against current state.
 * Called two ways: on a background interval from src/instrumentation.ts (this
 * app runs as a persistent `next start` process, so an in-process timer works
 * without any external scheduler), and again from getNotifications() for
 * immediate freshness right when a user opens the bell. Existing notifications
 * are loaded once up front and used to dedupe, so a condition only ever creates
 * one notification per entity, not one per tick/page load — and the whole sync
 * costs a fixed handful of queries rather than one per activity.
 */
export function syncTimeBasedNotifications(): Promise<void> {
    if (!inFlight) {
        inFlight = runSync().finally(() => {
            inFlight = null;
        });
    }
    return inFlight;
}

async function runSync(): Promise<void> {
    const now = new Date();

    const [activities, statusRules, evidenceCounts, openPeriods, existing] = await Promise.all([
        prisma.activity.findMany({ where: { approvalStatus: { not: 'DECLINED' } } }),
        prisma.rule.findMany({ select: { status: true, min: true, max: true } }),
        prisma.evidence.groupBy({ by: ['activityId'], _count: { _all: true } }),
        prisma.reportingPeriod.findMany({
            where: { status: 'OPEN' },
            include: { activities: { select: { responsibleId: true } } },
        }),
        prisma.notification.findMany({
            where: { type: { in: SYNCED_TYPES } },
            select: { type: true, userId: true, activityId: true, reportingPeriodId: true },
        }),
    ]);

    const activitiesWithEvidence = new Set(evidenceCounts.filter((e) => e._count._all > 0).map((e) => e.activityId));
    const seen = new Set(existing.map(dedupeKey));
    const pending: PendingNotification[] = [];
    const add = (n: PendingNotification) => {
        const key = dedupeKey(n);
        if (seen.has(key)) return;
        seen.add(key);
        pending.push(n);
    };

    for (const activity of activities) {
        if (activity.progress < 100) {
            if (isWithinDeadlineWindow(activity.endDate, now)) {
                add({
                    type: 'DEADLINE_APPROACHING',
                    userId: activity.responsibleId,
                    activityId: activity.id,
                    message: `"${activity.title}" is due on ${activity.endDate.toLocaleDateString()} — the deadline is approaching.`,
                });
            }

            const liveStatus = calculateActivityStatus({
                progress: activity.progress,
                startDate: activity.startDate,
                endDate: activity.endDate,
            }, statusRules);
            if (liveStatus === 'Delayed' || liveStatus === 'Overdue') {
                const delayDays = calculateDelayDays(activity, now);
                const delaySuffix = delayDays > 0 ? ` (${delayDays} day${delayDays === 1 ? '' : 's'} past deadline)` : '';
                add({
                    type: 'ACTIVITY_DELAYED',
                    userId: activity.responsibleId,
                    activityId: activity.id,
                    message: `"${activity.title}" is now ${liveStatus.toLowerCase()}${delaySuffix}.`,
                });
            }
        } else if (!activitiesWithEvidence.has(activity.id)) {
            add({
                type: 'EVIDENCE_MISSING',
                userId: activity.responsibleId,
                activityId: activity.id,
                message: `"${activity.title}" is marked complete but has no supporting evidence attached.`,
            });
        }
    }

    for (const period of openPeriods) {
        if (!isCutOffPassed(period)) continue;
        const responsibleIds = new Set(period.activities.map((a) => a.responsibleId));
        for (const userId of responsibleIds) {
            add({
                type: 'PERIOD_CLOSED',
                userId,
                reportingPeriodId: period.id,
                message: `The reporting period "${period.name}" has passed its cut-off date and is now closed for submissions.`,
            });
        }
    }

    if (pending.length === 0) return;
    await prisma.notification.createMany({
        data: pending.map((n) => ({ ...n, date: now, read: false })),
    });
}
