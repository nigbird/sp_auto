'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma';
import { hasPermission, requirePermission } from '@/lib/auth/permissions-server';
import { requireUser } from '@/lib/auth/session';
import { monthKey, monthKeyToDate, plannedPercentAtMonth, validateBreakdown, type BreakdownEntry, type TargetAggregation, type TargetType } from '@/lib/monthly-breakdown';

/**
 * Result of an action the UI reports back to the user. Returned rather than
 * thrown so the message survives Next.js' production error masking.
 */
export type BreakdownActionResult =
    | { success: true }
    | { success: false; message: string; formErrors?: string[]; rowErrors?: Record<number, string> };

function fail(message: string, extra: { formErrors?: string[]; rowErrors?: Record<number, string> } = {}): BreakdownActionResult {
    return { success: false, message, ...extra };
}

function revalidateBreakdownPages() {
    revalidatePath('/plan');
    revalidatePath('/plan/approvals');
    revalidatePath('/strategic-plan', 'layout');
}

/**
 * Ensures this activity has an ActivityPeriodEntry for every ReportingPeriod
 * that overlaps its own [startDate, endDate] range — the periods its actuals
 * are reported against. Safe to call repeatedly: only creates missing rows.
 */
export async function ensurePeriodEntriesForActivity(activityId: string) {
    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity || !activity.strategicPlanId) return;

    const overlappingPeriods = await prisma.reportingPeriod.findMany({
        where: {
            strategicPlanId: activity.strategicPlanId,
            startDate: { lte: activity.endDate },
            endDate: { gte: activity.startDate },
        },
    });
    if (overlappingPeriods.length === 0) return;

    const existing = await prisma.activityPeriodEntry.findMany({
        where: { activityId, reportingPeriodId: { in: overlappingPeriods.map(p => p.id) } },
        select: { reportingPeriodId: true },
    });
    const existingIds = new Set(existing.map(e => e.reportingPeriodId));
    const missing = overlappingPeriods.filter(p => !existingIds.has(p.id));
    if (missing.length === 0) return;

    await prisma.activityPeriodEntry.createMany({
        data: missing.map(p => ({ activityId, reportingPeriodId: p.id })),
    });
}

/**
 * Copies an approved monthly breakdown onto the activity's reporting-period
 * entries as each period's cumulative planned %, which is what actuals are
 * measured against when progress is reported.
 */
async function syncPlannedProgressFromBreakdown(activityId: string) {
    const activity = await prisma.activity.findUnique({
        where: { id: activityId },
        include: { monthlyTargets: true },
    });
    if (!activity || !activity.targetType || !activity.annualTarget) return;

    await ensurePeriodEntriesForActivity(activityId);
    const entries = await prisma.activityPeriodEntry.findMany({
        where: { activityId },
        include: { reportingPeriod: true },
    });
    const breakdown: BreakdownEntry[] = activity.monthlyTargets.map(t => ({ month: monthKey(t.month), value: t.value }));

    await prisma.$transaction(entries.map(entry =>
        prisma.activityPeriodEntry.update({
            where: { id: entry.id },
            data: {
                plannedProgress: plannedPercentAtMonth(activity.targetType as TargetType, activity.annualTarget!, breakdown, monthKey(entry.reportingPeriod.endDate), activity.targetAggregation),
            },
        })
    ));
}

/** An activity with what the breakdown form and approval list need to show. */
const breakdownInclude = {
    responsible: true,
    monthlyTargets: { orderBy: { month: 'asc' as const } },
    initiative: { include: { objective: { include: { pillar: true } } } },
    strategicPlan: { select: { id: true, name: true, status: true } },
};

export async function getActivityBreakdown(activityId: string) {
    const user = await requireUser();
    const activity = await prisma.activity.findUnique({ where: { id: activityId }, include: breakdownInclude });
    if (!activity) return null;
    if (activity.responsibleId !== user.id && !(await hasPermission(user.roleId, 'activities:edit'))) return null;
    return JSON.parse(JSON.stringify(activity));
}

export interface BreakdownSubmission {
    targetType: TargetType;
    aggregation: TargetAggregation;
    direction?: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
    annualTarget: number;
    entries: BreakdownEntry[];
}

/** Checks that `user` may fill in the breakdown for `activity` right now. */
function checkCanEditBreakdown(activity: { responsibleId: string; planRequestStatus: string; planSubmissionStatus: string | null; strategicPlan: { status: string } | null }, userId: string): string | null {
    if (activity.responsibleId !== userId) return "Only the person responsible for this activity can fill in its monthly breakdown.";
    if (activity.strategicPlan?.status !== 'PUBLISHED') return "This activity's strategic plan isn't published, so its breakdown can't be filled in yet.";
    if (activity.planRequestStatus !== 'ACCEPTED') return "Accept the monthly breakdown request for this activity first.";
    if (activity.planSubmissionStatus === 'PENDING') return "This breakdown is already waiting for approval. You can change it if an approver returns it.";
    if (activity.planSubmissionStatus === 'APPROVED') return "This breakdown has already been approved and can no longer be changed.";
    return null;
}

/** Anything but an explicit RECURRING counts as cumulative. */
function aggregationOf(input: { aggregation?: string }): TargetAggregation {
    return input.aggregation === 'RECURRING' ? 'RECURRING' : 'CUMULATIVE';
}

function breakdownRows(activityId: string, entries: BreakdownEntry[]) {
    return entries.map(e => ({ activityId, month: monthKeyToDate(e.month), value: Number(e.value) }));
}

/**
 * The responsible person's monthly breakdown for an activity — the annual
 * target, whether it's a % or a count, and the month(s) they commit to —
 * submitted together for approval.
 */
export async function submitActivityBreakdown(activityId: string, input: BreakdownSubmission): Promise<BreakdownActionResult> {
    const user = await requirePermission('my-activity:update');

    const activity = await prisma.activity.findUnique({ where: { id: activityId }, include: { strategicPlan: true } });
    if (!activity) return fail("This activity no longer exists.");

    const blocked = checkCanEditBreakdown(activity, user.id);
    if (blocked) return fail(blocked);

    const entries = (input.entries ?? []).map(e => ({ month: String(e.month ?? ''), value: Number(e.value) }));
    const annualTarget = Number(input.annualTarget);
    const validation = validateBreakdown({ targetType: input.targetType, aggregation: aggregationOf(input), annualTarget, entries, startDate: activity.startDate, endDate: activity.endDate });
    if (!validation.valid) {
        return fail(validation.formErrors[0] ?? 'Some months need fixing.', { formErrors: validation.formErrors, rowErrors: validation.rowErrors });
    }

    await prisma.$transaction([
        prisma.activityMonthlyTarget.deleteMany({ where: { activityId } }),
        prisma.activityMonthlyTarget.createMany({ data: breakdownRows(activityId, entries) }),
        prisma.activity.update({
            where: { id: activityId },
            data: {
                targetType: input.targetType,
                targetAggregation: aggregationOf(input),
                targetDirection: input.direction === 'LOWER_IS_BETTER' ? 'LOWER_IS_BETTER' : 'HIGHER_IS_BETTER',
                annualTarget,
                planSubmissionStatus: 'PENDING',
                planDeclineReason: null,
                planSubmittedById: user.id,
                planSubmittedAt: new Date(),
                planApprovedById: null,
                planApprovedAt: null,
            },
        }),
    ]);

    if (activity.planRequestSentById && activity.planRequestSentById !== user.id) {
        await prisma.notification.create({
            data: {
                type: 'PLAN_SUBMITTED',
                message: `${user.name} submitted the monthly breakdown for "${activity.title}" for approval.`,
                date: new Date(),
                read: false,
                userId: activity.planRequestSentById,
                activityId: activity.id,
            },
        });
    }

    revalidateBreakdownPages();
    return { success: true };
}

export interface ProposedActivityInput extends BreakdownSubmission {
    title: string;
    deliverable?: string;
    startDate: string;
    endDate: string;
}

/**
 * Lets the responsible person add another activity they need under the same
 * initiative while filling in their breakdown. It goes in with its own
 * breakdown, weight 0, and stays pending until an approver approves the
 * breakdown (which approves the activity too).
 */
export async function proposeActivityWithBreakdown(siblingActivityId: string, input: ProposedActivityInput): Promise<BreakdownActionResult> {
    const user = await requirePermission('my-activity:update');

    const sibling = await prisma.activity.findUnique({ where: { id: siblingActivityId }, include: { strategicPlan: true } });
    if (!sibling) return fail("The activity you're adding to no longer exists.");
    if (sibling.responsibleId !== user.id) return fail("You can only add activities next to ones you are responsible for.");
    if (sibling.strategicPlan?.status !== 'PUBLISHED') return fail("This strategic plan isn't published, so activities can't be added to it yet.");
    if (sibling.planRequestStatus !== 'ACCEPTED') return fail("Accept the monthly breakdown request first.");

    const formErrors: string[] = [];
    const title = (input.title ?? '').trim();
    if (!title) formErrors.push('Activity title is required.');
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    if (Number.isNaN(start.getTime())) formErrors.push('Start date is required.');
    if (Number.isNaN(end.getTime())) formErrors.push('End date is required.');
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end <= start) formErrors.push('End date must be after the start date.');
    if ((input.deliverable ?? '').length > 1000) formErrors.push('Deliverable must be 1000 characters or less.');
    if (formErrors.length > 0) return fail(formErrors[0], { formErrors });

    const entries = (input.entries ?? []).map(e => ({ month: String(e.month ?? ''), value: Number(e.value) }));
    const annualTarget = Number(input.annualTarget);
    const validation = validateBreakdown({ targetType: input.targetType, aggregation: aggregationOf(input), annualTarget, entries, startDate: start, endDate: end });
    if (!validation.valid) {
        return fail(validation.formErrors[0] ?? 'Some months need fixing.', { formErrors: validation.formErrors, rowErrors: validation.rowErrors });
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
        const created = await tx.activity.create({
            data: {
                title,
                description: '',
                deliverable: input.deliverable?.trim() || null,
                department: sibling.department,
                responsibleId: user.id,
                startDate: start,
                endDate: end,
                status: 'Not Started',
                weight: 0,
                progress: 0,
                approvalStatus: 'PENDING',
                initiativeId: sibling.initiativeId,
                strategicPlanId: sibling.strategicPlanId,
                proposedByOwner: true,
                planRequestStatus: 'ACCEPTED',
                planRequestSentAt: now,
                planRequestSentById: sibling.planRequestSentById,
                planRequestRespondedAt: now,
                targetType: input.targetType,
                targetAggregation: aggregationOf(input),
                targetDirection: input.direction === 'LOWER_IS_BETTER' ? 'LOWER_IS_BETTER' : 'HIGHER_IS_BETTER',
                annualTarget,
                planSubmissionStatus: 'PENDING',
                planSubmittedById: user.id,
                planSubmittedAt: now,
            },
        });
        await tx.activityMonthlyTarget.createMany({ data: breakdownRows(created.id, entries) });
    });

    revalidateBreakdownPages();
    return { success: true };
}

export async function getPendingActivityPlans() {
    await requirePermission('activities:edit');

    const activities = await prisma.activity.findMany({
        where: { planSubmissionStatus: 'PENDING' },
        include: breakdownInclude,
        orderBy: { planSubmittedAt: 'asc' },
    });
    return JSON.parse(JSON.stringify(activities));
}

export async function approveActivityPlan(activityId: string): Promise<BreakdownActionResult> {
    const approver = await requirePermission('activities:edit');

    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) return fail("This activity no longer exists.");
    if (activity.planSubmissionStatus !== 'PENDING') return fail("This breakdown isn't waiting for approval any more — it may already have been handled.");

    await prisma.activity.update({
        where: { id: activityId },
        data: {
            planSubmissionStatus: 'APPROVED',
            planDeclineReason: null,
            planApprovedById: approver.id,
            planApprovedAt: new Date(),
            // An activity the owner added themselves is approved along with its breakdown.
            ...(activity.proposedByOwner && activity.approvalStatus === 'PENDING' ? { approvalStatus: 'APPROVED' as const, declineReason: null } : {}),
        },
    });
    await syncPlannedProgressFromBreakdown(activityId);

    await prisma.notification.create({
        data: {
            type: 'PLAN_APPROVED',
            message: `Your monthly breakdown for "${activity.title}" was approved.`,
            date: new Date(),
            read: false,
            userId: activity.responsibleId,
            activityId: activity.id,
        },
    });

    revalidateBreakdownPages();
    return { success: true };
}

export async function declineActivityPlan(activityId: string, reason: string): Promise<BreakdownActionResult> {
    await requirePermission('activities:edit');

    const trimmed = (reason ?? '').trim();
    if (!trimmed) return fail("Please give a reason so the owner knows what to change.");

    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) return fail("This activity no longer exists.");
    if (activity.planSubmissionStatus !== 'PENDING') return fail("This breakdown isn't waiting for approval any more — it may already have been handled.");

    await prisma.activity.update({
        where: { id: activityId },
        data: { planSubmissionStatus: 'DECLINED', planDeclineReason: trimmed },
    });

    await prisma.notification.create({
        data: {
            type: 'PLAN_DECLINED',
            message: `Your monthly breakdown for "${activity.title}" was returned: ${trimmed}`,
            date: new Date(),
            read: false,
            userId: activity.responsibleId,
            activityId: activity.id,
        },
    });

    revalidateBreakdownPages();
    return { success: true };
}

/**
 * The admin-facing list for the "Send Plan Requests" screen: every initiative
 * in a published plan with its activities' request status.
 */
export async function getInitiativesForPlanRequests() {
    await requirePermission('activities:edit');

    return prisma.initiative.findMany({
        where: { objective: { pillar: { strategicPlan: { status: 'PUBLISHED' } } } },
        include: {
            owner: true,
            objective: { include: { pillar: true } },
            activities: { include: { responsible: true } },
        },
        orderBy: { title: 'asc' },
    });
}

/**
 * Marks the given activities' breakdown requests as SENT to each activity's
 * responsible person and notifies them. Already-sent or accepted activities
 * are left alone; declined ones are re-sent.
 */
async function sendRequests(where: { initiativeId?: string; strategicPlanId?: string }, senderId: string): Promise<number> {
    const activities = await prisma.activity.findMany({
        where: { ...where, planRequestStatus: { in: ['NOT_SENT', 'DECLINED'] } },
    });
    if (activities.length === 0) return 0;

    const now = new Date();
    await prisma.activity.updateMany({
        where: { id: { in: activities.map(a => a.id) } },
        data: {
            planRequestStatus: 'SENT',
            planRequestSentAt: now,
            planRequestSentById: senderId,
            planRequestRespondedAt: null,
            planRequestDeclineReason: null,
        },
    });

    const countByUser = new Map<string, number>();
    for (const a of activities) countByUser.set(a.responsibleId, (countByUser.get(a.responsibleId) ?? 0) + 1);
    await prisma.notification.createMany({
        data: Array.from(countByUser.entries()).map(([userId, count]) => ({
            type: 'PLAN_REQUEST_SENT',
            message: `You've been asked to fill in the monthly breakdown for ${count} ${count === 1 ? 'activity' : 'activities'}. Open My Activity to start.`,
            date: now,
            read: false,
            userId,
        })),
    });

    revalidateBreakdownPages();
    return activities.length;
}

async function isInitiativeInPublishedPlan(initiativeId: string) {
    const initiative = await prisma.initiative.findUnique({
        where: { id: initiativeId },
        select: { objective: { select: { pillar: { select: { strategicPlan: { select: { status: true } } } } } } },
    });
    return initiative?.objective.pillar.strategicPlan?.status === 'PUBLISHED';
}

export async function sendPlanRequestsForInitiative(initiativeId: string): Promise<BreakdownActionResult & { sent?: number }> {
    const sender = await requirePermission('activities:edit');
    if (!(await isInitiativeInPublishedPlan(initiativeId))) {
        return fail("Publish this initiative's strategic plan before sending breakdown requests.");
    }
    const sent = await sendRequests({ initiativeId }, sender.id);
    if (sent === 0) return fail("Every activity in this initiative already has a request sent or accepted.");
    return { success: true, sent };
}

/** The "send monthly breakdown requests" button on a published plan. */
export async function sendPlanRequestsForPlan(planId: string): Promise<BreakdownActionResult & { sent?: number }> {
    const sender = await requirePermission('activities:edit');
    const plan = await prisma.strategicPlan.findUnique({ where: { id: planId }, select: { status: true } });
    if (!plan) return fail("This plan no longer exists.");
    if (plan.status !== 'PUBLISHED') return fail("Publish the plan before sending breakdown requests.");
    const sent = await sendRequests({ strategicPlanId: planId }, sender.id);
    if (sent === 0) return fail("Every activity in this plan already has a request sent or accepted.");
    return { success: true, sent };
}

export async function acceptPlanRequest(activityId: string): Promise<BreakdownActionResult> {
    const user = await requirePermission('my-activity:update');

    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) return fail("This activity no longer exists.");
    if (activity.responsibleId !== user.id) return fail("Only the person responsible for this activity can accept its request.");
    if (activity.planRequestStatus !== 'SENT') return fail("There's no open request to accept for this activity.");

    await prisma.activity.update({
        where: { id: activityId },
        data: {
            planRequestStatus: 'ACCEPTED',
            planRequestRespondedAt: new Date(),
            planRequestDeclineReason: null,
        },
    });

    revalidatePath('/plan');
    return { success: true };
}

export async function declinePlanRequest(activityId: string, reason: string): Promise<BreakdownActionResult> {
    const user = await requirePermission('my-activity:update');

    const trimmed = (reason ?? '').trim();
    if (!trimmed) return fail("Please give a reason for declining.");

    const existing = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!existing) return fail("This activity no longer exists.");
    if (existing.responsibleId !== user.id) return fail("Only the person responsible for this activity can decline its request.");
    if (existing.planRequestStatus !== 'SENT') return fail("There's no open request to decline for this activity.");

    const activity = await prisma.activity.update({
        where: { id: activityId },
        data: {
            planRequestStatus: 'DECLINED',
            planRequestRespondedAt: new Date(),
            planRequestDeclineReason: trimmed,
        },
    });

    if (activity.planRequestSentById) {
        await prisma.notification.create({
            data: {
                type: 'PLAN_REQUEST_DECLINED',
                message: `"${activity.title}" — the breakdown request was declined: ${trimmed}`,
                date: new Date(),
                read: false,
                userId: activity.planRequestSentById,
                activityId: activity.id,
            },
        });
    }

    revalidateBreakdownPages();
    return { success: true };
}
