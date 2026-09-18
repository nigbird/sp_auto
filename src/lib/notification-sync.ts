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

async function createNotificationIfMissing(params: {
    type: NotificationType;
    userId: string;
    message: string;
    activityId?: string;
    reportingPeriodId?: string;
}): Promise<void> {
    const existing = await prisma.notification.findFirst({
        where: {
            type: params.type,
            userId: params.userId,
            activityId: params.activityId ?? null,
            reportingPeriodId: params.reportingPeriodId ?? null,
        },
    });
    if (existing) return;

    await prisma.notification.create({
        data: {
            type: params.type,
            message: params.message,
            date: new Date(),
            read: false,
            userId: params.userId,
            activityId: params.activityId,
            reportingPeriodId: params.reportingPeriodId,
        },
    });
}

/**
 * Evaluates time-based notification conditions (deadline approaching, delayed,
 * evidence missing, a period's cut-off silently passing) against current state.
 * Called two ways: on a background interval from src/instrumentation.ts (this
 * app runs as a persistent `next start` process, so an in-process timer works
 * without any external scheduler), and again from getNotifications() for
 * immediate freshness right when a user opens the bell. createNotificationIfMissing
 * dedupes so a condition only ever creates one notification per entity, not one
 * per tick/page load.
 */
export async function syncTimeBasedNotifications(): Promise<void> {
    const now = new Date();

    const [activities, statusRules] = await Promise.all([
        prisma.activity.findMany({ where: { approvalStatus: { not: 'DECLINED' } } }),
        prisma.rule.findMany({ select: { status: true, min: true, max: true } }),
    ]);

    for (const activity of activities) {
        if (activity.progress < 100) {
            if (isWithinDeadlineWindow(activity.endDate, now)) {
                await createNotificationIfMissing({
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
                await createNotificationIfMissing({
                    type: 'ACTIVITY_DELAYED',
                    userId: activity.responsibleId,
                    activityId: activity.id,
                    message: `"${activity.title}" is now ${liveStatus.toLowerCase()}${delaySuffix}.`,
                });
            }
        } else {
            const evidenceCount = await prisma.evidence.count({ where: { activityId: activity.id } });
            if (evidenceCount === 0) {
                await createNotificationIfMissing({
                    type: 'EVIDENCE_MISSING',
                    userId: activity.responsibleId,
                    activityId: activity.id,
                    message: `"${activity.title}" is marked complete but has no supporting evidence attached.`,
                });
            }
        }
    }

    const openPeriods = await prisma.reportingPeriod.findMany({
        where: { status: 'OPEN' },
        include: { activities: { select: { responsibleId: true } } },
    });

    for (const period of openPeriods) {
        if (!isCutOffPassed(period)) continue;
        const responsibleIds = new Set(period.activities.map((a) => a.responsibleId));
        for (const userId of responsibleIds) {
            await createNotificationIfMissing({
                type: 'PERIOD_CLOSED',
                userId,
                reportingPeriodId: period.id,
                message: `The reporting period "${period.name}" has passed its cut-off date and is now closed for submissions.`,
            });
        }
    }
}
