
'use server'

import { prisma } from '@/lib/prisma';
import type { Notification } from '@/lib/types';
import { requireUser } from '@/lib/auth/session';
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
 * There's no scheduler in this app (plain `next start`, no cron/worker), so
 * time-based notifications (deadline approaching, delayed, evidence missing,
 * a period's cut-off silently passing) are evaluated live here instead of on
 * a schedule — this runs on every notification-bell load. createNotificationIfMissing
 * dedupes so a condition only ever creates one notification per entity, not
 * one per page load.
 */
async function syncTimeBasedNotifications(): Promise<void> {
    const now = new Date();

    const activities = await prisma.activity.findMany({
        where: { approvalStatus: { not: 'DECLINED' } },
    });

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
            });
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

export async function getNotifications(): Promise<Notification[]> {
    const user = await requireUser();

    await syncTimeBasedNotifications();

    return await prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { date: 'desc' },
    });
}

export async function markNotificationRead(id: string): Promise<void> {
    const user = await requireUser();
    await prisma.notification.updateMany({
        where: { id, userId: user.id },
        data: { read: true },
    });
}

export async function markAllNotificationsRead(): Promise<void> {
    const user = await requireUser();
    await prisma.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
    });
}
