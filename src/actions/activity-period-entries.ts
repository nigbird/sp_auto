'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { calculateActivityStatus, type StatusRule } from '@/lib/utils';
import { computeAchievementPercent } from '@/lib/period-achievement';
import { isPeriodClosedForSubmissions } from '@/lib/reporting-period';
import { requirePermission } from '@/lib/auth/permissions-server';
import { requireUser } from '@/lib/auth/session';
import { ensurePeriodEntriesForActivity } from '@/actions/activity-plan-submissions';

async function getStatusRules(): Promise<StatusRule[]> {
    return prisma.rule.findMany({ select: { status: true, min: true, max: true } });
}

export async function getActivityPeriodEntries(activityId: string) {
    await requireUser();
    return prisma.activityPeriodEntry.findMany({
        where: { activityId },
        include: { reportingPeriod: true },
        orderBy: { reportingPeriod: { startDate: 'asc' } },
    });
}

/**
 * Finds the entry a lead owner can currently submit an actual against: among
 * all of this activity's period entries (one per ReportingPeriod overlapping
 * its date range — see ensurePeriodEntriesForActivity), the one whose period
 * is presently open for submissions, once the monthly breakdown is approved.
 */
async function getCurrentSubmittableEntry(activityId: string) {
    await ensurePeriodEntriesForActivity(activityId);
    const entries = await prisma.activityPeriodEntry.findMany({
        where: { activityId },
        include: { reportingPeriod: true },
        orderBy: { reportingPeriod: { startDate: 'asc' } },
    });

    const openEntry = entries.find(e => !isPeriodClosedForSubmissions(e.reportingPeriod));
    if (!openEntry) {
        throw new Error("No reporting period is currently open for this activity.");
    }
    const activity = await prisma.activity.findUnique({ where: { id: activityId }, select: { planSubmissionStatus: true } });
    if (activity?.planSubmissionStatus !== 'APPROVED') {
        throw new Error("This activity's monthly breakdown hasn't been approved yet — submit it from My Plan → Monthly Breakdown and get it approved before reporting progress.");
    }
    return openEntry;
}

/**
 * The lead-owner's submission against the activity's assigned reporting
 * period — replaces the old flat submitActivityUpdate. Mirrors the Excel's
 * AH (cumulative actual) column, enforced with the reporting rules the
 * operational side asked for: no submitting into a closed period, actual
 * can't regress below the last period's approved value, actual can't exceed
 * the achievement cap relative to plan, and a variance/way-forward narrative
 * is required whenever the actual falls short of this period's plan.
 */
export async function submitPeriodUpdate(
    activityId: string,
    actualProgress: number,
    comment: string,
    completionDate?: string,
    delayExplanation?: string,
    recommendedAction?: string,
    escalationIssues?: string
) {
    const user = await requirePermission('my-activity:update');

    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new Error("Activity not found");

    const entry = await getCurrentSubmittableEntry(activityId);

    // Cumulative actual can't decrease from the most recently approved period entry for this activity.
    const priorApproved = await prisma.activityPeriodEntry.findMany({
        where: { activityId, id: { not: entry.id }, actualProgress: { not: null } },
        include: { reportingPeriod: true },
        orderBy: { reportingPeriod: { startDate: 'desc' } },
        take: 1,
    });
    const latestApproved = priorApproved[0];
    if (latestApproved && latestApproved.actualProgress != null && actualProgress < latestApproved.actualProgress) {
        throw new Error(`The actual progress can't decrease from the ${latestApproved.reportingPeriod.name} approved value of ${latestApproved.actualProgress}%.`);
    }

    // Actual can't blow past the configured achievement cap relative to this period's plan.
    const appConfig = await prisma.appConfig.upsert({ where: { id: 'singleton' }, update: {}, create: { id: 'singleton' } });
    const achievement = computeAchievementPercent({ plannedProgress: entry.plannedProgress, actualProgress }, Infinity);
    if (achievement != null && achievement > appConfig.achievementCapPercent) {
        throw new Error(`This actual (${achievement.toFixed(0)}% of plan) exceeds the configured achievement cap of ${appConfig.achievementCapPercent}%. Double-check the value, or ask an admin to raise the cap.`);
    }

    if (actualProgress >= 100) {
        if (!completionDate) {
            throw new Error("Completing this activity requires a completion date.");
        }
        const evidenceCount = await prisma.evidence.count({ where: { activityId } });
        if (evidenceCount === 0) {
            throw new Error("Completing this activity requires at least one piece of supporting evidence to be attached first.");
        }
        const undeliveredDeliverables = await prisma.deliverable.findMany({
            where: { activityId, isDelivered: false },
            select: { title: true },
        });
        if (undeliveredDeliverables.length > 0) {
            throw new Error(`Completing this activity requires all deliverables to be marked delivered first: ${undeliveredDeliverables.map(d => `"${d.title}"`).join(', ')}.`);
        }
    }

    const statusRules = await getStatusRules();
    const projectedStatus = calculateActivityStatus({ ...activity, progress: actualProgress }, statusRules);
    const isBehindPlan = actualProgress < entry.plannedProgress;
    if (isBehindPlan || projectedStatus === 'Delayed' || projectedStatus === 'Overdue') {
        if (!delayExplanation?.trim() || !recommendedAction?.trim()) {
            throw new Error("Reporting a result behind this period's plan requires both a reason for the variation and a way forward.");
        }
    }

    const pendingUpdate = {
        user: user.name,
        date: new Date(),
        comment,
        progress: actualProgress,
        completionDate: completionDate || undefined,
        delayExplanation: delayExplanation || undefined,
        recommendedAction: recommendedAction || undefined,
    };

    const activityUpdateData: any = {
        pendingUpdate: JSON.stringify(pendingUpdate),
        approvalStatus: 'PENDING',
    };
    if (activity.status === 'Not Started' && actualProgress > 0 && projectedStatus !== 'Not Started') {
        activityUpdateData.status = projectedStatus;
    }

    await prisma.$transaction([
        prisma.activityPeriodEntry.update({
            where: { id: entry.id },
            data: {
                pendingActualProgress: actualProgress,
                comment,
                reasonForVariation: isBehindPlan ? delayExplanation : null,
                wayForward: isBehindPlan ? recommendedAction : null,
                escalationIssues: escalationIssues || null,
                approvalStatus: 'PENDING',
                declineReason: null,
                submittedById: user.id,
                submittedAt: new Date(),
            },
        }),
        prisma.activity.update({ where: { id: activityId }, data: activityUpdateData }),
    ]);

    revalidatePath('/plan');
}

export async function approvePeriodEntry(activityId: string) {
    const approver = await requirePermission('activities:edit');

    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) return;

    const entry = await prisma.activityPeriodEntry.findFirst({
        where: { activityId, pendingActualProgress: { not: null } },
    });

    if (entry && entry.pendingActualProgress != null) {
        const pendingActualProgress = entry.pendingActualProgress;
        const rules = await getStatusRules();
        const newStatus = calculateActivityStatus({ ...activity, progress: pendingActualProgress }, rules);

        await prisma.$transaction([
            prisma.activityPeriodEntry.update({
                where: { id: entry.id },
                data: {
                    actualProgress: pendingActualProgress,
                    pendingActualProgress: null,
                    approvalStatus: 'APPROVED',
                    declineReason: null,
                    approvedById: approver.id,
                    approvedAt: new Date(),
                },
            }),
            prisma.activity.update({
                where: { id: activityId },
                data: {
                    progress: pendingActualProgress,
                    status: newStatus,
                    pendingUpdate: Prisma.JsonNull,
                    approvalStatus: 'APPROVED',
                    declineReason: null,
                    updatedAt: new Date(),
                    ...(entry.reasonForVariation ? { delayExplanation: entry.reasonForVariation } : {}),
                    ...(entry.wayForward ? { recommendedAction: entry.wayForward } : {}),
                },
            }),
        ]);
    } else {
        // No pending period entry — this is a brand-new activity awaiting its
        // initial creation approval, not a progress update.
        await prisma.activity.update({
            where: { id: activityId },
            data: { approvalStatus: 'APPROVED', declineReason: null },
        });
    }

    await prisma.notification.create({
        data: {
            type: 'UPDATE_APPROVED',
            message: `Your update for "${activity.title}" was approved.`,
            date: new Date(),
            read: false,
            userId: activity.responsibleId,
            activityId: activity.id,
        },
    });

    revalidatePath('/plan');
}

export async function declinePeriodEntry(activityId: string, reason: string) {
    await requirePermission('activities:edit');

    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) return;

    const entry = await prisma.activityPeriodEntry.findFirst({
        where: { activityId, pendingActualProgress: { not: null } },
    });

    if (entry) {
        await prisma.$transaction([
            prisma.activityPeriodEntry.update({
                where: { id: entry.id },
                data: { pendingActualProgress: null, approvalStatus: 'DECLINED', declineReason: reason },
            }),
            prisma.activity.update({
                where: { id: activityId },
                data: { pendingUpdate: Prisma.JsonNull, approvalStatus: 'DECLINED', declineReason: reason },
            }),
        ]);
    } else {
        await prisma.activity.update({
            where: { id: activityId },
            data: { approvalStatus: 'DECLINED', declineReason: reason },
        });
    }

    await prisma.notification.create({
        data: {
            type: 'UPDATE_DECLINED',
            message: `Your update for "${activity.title}" was returned: ${reason}`,
            date: new Date(),
            read: false,
            userId: activity.responsibleId,
            activityId: activity.id,
        },
    });

    revalidatePath('/plan');
}
