'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions-server';
import { recordAudit } from '@/lib/auth/audit';

export interface MonthlyPlanEntryInput {
    reportingPeriodId: string;
    plannedProgress: number;
}

/**
 * Sets an activity's fixed monthly plan curve — the planner-only equivalent
 * of the Excel's T:AE columns. Called from the plan wizard, never by a lead
 * owner. Upserts one ActivityPeriodEntry per (activity, period) pair without
 * touching any already-submitted/approved actuals.
 */
export async function setActivityMonthlyPlan(activityId: string, entries: MonthlyPlanEntryInput[]) {
    await requirePermission('strategic-plan:edit');

    await prisma.$transaction(
        entries.map(({ reportingPeriodId, plannedProgress }) =>
            prisma.activityPeriodEntry.upsert({
                where: { activityId_reportingPeriodId: { activityId, reportingPeriodId } },
                update: { plannedProgress },
                create: { activityId, reportingPeriodId, plannedProgress },
            })
        )
    );
    await recordAudit({
        action: 'ACTIVITY_MONTHLY_PLAN_SET', entityType: 'Activity', entityId: activityId,
        summary: `Set the monthly plan for ${await activityLabel(activityId)} (${entries.length} periods)`,
        metadata: { entries },
    });

    revalidatePath('/strategic-plan');
    revalidatePath('/plan');
}

/**
 * Links an activity as a duplicate/shared copy of another (same underlying
 * work item, reported separately by a second owning department). The linked
 * activity is excluded from weight rollups so its contribution isn't counted
 * twice — mirrors the Excel's "No Duplicate" weight column.
 */
export async function linkDuplicateActivity(activityId: string, duplicateGroupId: string) {
    await requirePermission('strategic-plan:edit');

    const groupMembers = await prisma.activity.findMany({
        where: { duplicateGroupId },
        select: { id: true },
    });

    await prisma.activity.update({
        where: { id: activityId },
        data: {
            duplicateGroupId,
            // The first-linked member of a group keeps its weight (matches the
            // Excel row order); every subsequent one defaults to not counting.
            countsTowardWeight: groupMembers.length === 0,
        },
    });
    await recordAudit({
        action: 'ACTIVITY_DUPLICATE_LINKED', entityType: 'Activity', entityId: activityId,
        summary: `Linked ${await activityLabel(activityId)} as a duplicate (${groupMembers.length === 0 ? 'counts toward weight' : 'excluded from weight'})`,
        metadata: { duplicateGroupId },
    });

    revalidatePath('/strategic-plan');
}

export async function unlinkDuplicateActivity(activityId: string) {
    await requirePermission('strategic-plan:edit');

    await prisma.activity.update({
        where: { id: activityId },
        data: { duplicateGroupId: null, countsTowardWeight: true },
    });
    await recordAudit({
        action: 'ACTIVITY_DUPLICATE_UNLINKED', entityType: 'Activity', entityId: activityId,
        summary: `Unlinked ${await activityLabel(activityId)} from its duplicate group`,
    });

    revalidatePath('/strategic-plan');
}

async function activityLabel(id: string) {
    const activity = await prisma.activity.findUnique({ where: { id }, select: { title: true } });
    return activity ? `"${activity.title}"` : 'an activity';
}
