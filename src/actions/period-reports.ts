'use server'

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/permissions-server';
import { requireUser } from '@/lib/auth/session';
import { isPeriodClosedForSubmissions } from '@/lib/reporting-period';
import { computeReportRow, planToDateForPeriod } from '@/lib/report-calculations';
import { formatTargetValue, type TargetType } from '@/lib/monthly-breakdown';
import { calculateActivityStatus } from '@/lib/utils';

/** Returned rather than thrown so the message survives Next.js' production error masking. */
export type ReportActionResult =
    | { success: true; count?: number }
    | { success: false; message: string; fieldErrors?: Record<string, string> };

function fail(message: string, fieldErrors?: Record<string, string>): ReportActionResult {
    return { success: false, message, ...(fieldErrors ? { fieldErrors } : {}) };
}

function revalidateReportPages() {
    revalidatePath('/my-activity');
    revalidatePath('/approvals');
    revalidatePath('/settings/reporting-periods');
    revalidatePath('/strategic-plan', 'layout');
}

/** Activities that get a report row for a period: approved, with an approved monthly breakdown, and already started by the period's end. */
function reportableActivitiesWhere(strategicPlanId: string, periodEnd: Date) {
    return {
        strategicPlanId,
        approvalStatus: 'APPROVED' as const,
        planSubmissionStatus: 'APPROVED' as const,
        startDate: { lte: periodEnd },
    };
}

/** Counts per reporting period for the Reporting Periods page. */
export async function getReportSummaries(strategicPlanId: string) {
    await requireUser();
    const grouped = await prisma.activityPeriodEntry.groupBy({
        by: ['reportingPeriodId', 'reportStatus'],
        where: { reportingPeriod: { strategicPlanId }, reportStatus: { not: 'NOT_REQUESTED' } },
        _count: { _all: true },
    });
    const summaries: Record<string, { requested: number; submitted: number; approved: number; returned: number; total: number }> = {};
    for (const row of grouped) {
        const s = summaries[row.reportingPeriodId] ??= { requested: 0, submitted: 0, approved: 0, returned: 0, total: 0 };
        const n = row._count._all;
        s.total += n;
        if (row.reportStatus === 'REQUESTED') s.requested += n;
        if (row.reportStatus === 'SUBMITTED') s.submitted += n;
        if (row.reportStatus === 'APPROVED') s.approved += n;
        if (row.reportStatus === 'RETURNED') s.returned += n;
    }
    return summaries;
}

/**
 * The "Send Report Request" button on a reporting period: every activity
 * that should report this period gets a row to fill in, and its responsible
 * person is notified with the message. Can be sent again later — it only
 * adds activities that weren't requested yet, and never touches reports that
 * are already submitted or approved.
 */
export async function sendReportRequest(periodId: string, message: string): Promise<ReportActionResult> {
    const sender = await requirePermission('activities:edit');

    const period = await prisma.reportingPeriod.findUnique({ where: { id: periodId }, include: { strategicPlan: true } });
    if (!period) return fail('This reporting period no longer exists.');
    if (period.strategicPlan.status !== 'PUBLISHED') return fail("This period's strategic plan isn't published yet.");
    if (isPeriodClosedForSubmissions(period)) return fail('This period is closed or past its cut-off date, so reports can no longer be requested for it.');
    const trimmed = (message ?? '').trim();
    if (!trimmed) return fail('Write a short message for the activity owners before sending.', { message: 'A message is required.' });
    if (trimmed.length > 2000) return fail('The message must be 2000 characters or less.', { message: 'Too long (max 2000 characters).' });

    const activities = await prisma.activity.findMany({
        where: reportableActivitiesWhere(period.strategicPlanId, period.endDate),
        include: { monthlyTargets: true, periodEntries: { where: { reportingPeriodId: periodId } } },
    });
    if (activities.length === 0) {
        return fail('No activity is ready to report for this period. Activities need an approved monthly breakdown and a start date on or before the period ends.');
    }

    const now = new Date();
    const toRequest = activities.filter(a => {
        const existing = a.periodEntries[0];
        return !existing || existing.reportStatus === 'NOT_REQUESTED';
    });

    await prisma.$transaction([
        ...toRequest.map(a => {
            const planToDate = planToDateForPeriod({ monthlyTargets: a.monthlyTargets, targetAggregation: a.targetAggregation }, period.endDate);
            return prisma.activityPeriodEntry.upsert({
                where: { activityId_reportingPeriodId: { activityId: a.id, reportingPeriodId: periodId } },
                create: { activityId: a.id, reportingPeriodId: periodId, reportStatus: 'REQUESTED', reportRequestedAt: now, planToDate },
                update: { reportStatus: 'REQUESTED', reportRequestedAt: now, planToDate },
            });
        }),
        prisma.reportingPeriod.update({
            where: { id: periodId },
            data: { reportRequestMessage: trimmed, reportRequestSentAt: now, reportRequestSentById: sender.id },
        }),
    ]);

    const countByUser = new Map<string, number>();
    for (const a of toRequest) countByUser.set(a.responsibleId, (countByUser.get(a.responsibleId) ?? 0) + 1);
    if (countByUser.size > 0) {
        await prisma.notification.createMany({
            data: Array.from(countByUser.entries()).map(([userId, count]) => ({
                type: 'REPORT_REQUESTED',
                message: `Report for "${period.name}" requested for ${count} ${count === 1 ? 'activity' : 'activities'}: ${trimmed}`,
                date: now,
                read: false,
                userId,
                reportingPeriodId: periodId,
            })),
        });
    }

    revalidateReportPages();
    return { success: true, count: toRequest.length };
}

const reportEntryInclude = {
    reportingPeriod: true,
    activity: {
        include: {
            responsible: true,
            monthlyTargets: { orderBy: { month: 'asc' as const } },
            initiative: { include: { objective: { include: { pillar: true } } } },
        },
    },
};

/** Report rows the current user has to fill in (or has filled in) — My Activity → Reports. */
export async function getMyPeriodReports() {
    const user = await requireUser();
    const entries = await prisma.activityPeriodEntry.findMany({
        where: { reportStatus: { not: 'NOT_REQUESTED' }, activity: { responsibleId: user.id } },
        include: reportEntryInclude,
        orderBy: [{ reportingPeriod: { endDate: 'desc' } }, { activity: { title: 'asc' } }],
    });
    return JSON.parse(JSON.stringify(entries));
}

export interface PeriodReportInput {
    actualToDate: number | null;
    completionDate?: string | null;
    accomplishedTasks?: string;
    reasonForVariation?: string;
    wayForward?: string;
    escalationIssues?: string;
}

/** The latest approved actual from an earlier period — actuals are cumulative, so they can't go down. */
async function previousApprovedActual(activityId: string, beforeDate: Date) {
    return prisma.activityPeriodEntry.findFirst({
        where: { activityId, reportStatus: 'APPROVED', actualToDate: { not: null }, reportingPeriod: { endDate: { lt: beforeDate } } },
        include: { reportingPeriod: true },
        orderBy: { reportingPeriod: { endDate: 'desc' } },
    });
}

export async function submitPeriodReport(entryId: string, input: PeriodReportInput): Promise<ReportActionResult> {
    const user = await requirePermission('my-activity:update');

    const entry = await prisma.activityPeriodEntry.findUnique({ where: { id: entryId }, include: reportEntryInclude });
    if (!entry) return fail('This report no longer exists.');
    const { activity, reportingPeriod: period } = entry;
    if (activity.responsibleId !== user.id) return fail('Only the person responsible for this activity can submit its report.');
    if (entry.reportStatus === 'SUBMITTED') return fail('This report is already waiting for approval.');
    if (entry.reportStatus === 'APPROVED') return fail('This report has already been approved and can no longer be changed.');
    if (entry.reportStatus !== 'REQUESTED' && entry.reportStatus !== 'RETURNED') return fail("This report hasn't been requested.");
    if (isPeriodClosedForSubmissions(period)) return fail(`"${period.name}" is closed or past its cut-off date, so reports can no longer be submitted.`);

    const fieldErrors: Record<string, string> = {};
    const targetType = activity.targetType as TargetType | null;
    const target = activity.annualTarget ?? 0;
    const actual = input.actualToDate;

    if (actual == null || !Number.isFinite(actual)) {
        fieldErrors.actualToDate = 'Enter the actual achieved up to this period.';
    } else if (actual < 0) {
        fieldErrors.actualToDate = "Actual can't be negative.";
    } else if (targetType === 'PERCENT' && actual > 100) {
        fieldErrors.actualToDate = "A percentage can't be more than 100%.";
    } else if (activity.targetAggregation === 'CUMULATIVE' && activity.targetDirection === 'HIGHER_IS_BETTER') {
        // Only one-off work accumulates; an ongoing level or a lower-is-better ratio can move either way.
        const previous = await previousApprovedActual(activity.id, period.endDate);
        if (previous?.actualToDate != null && actual < previous.actualToDate) {
            fieldErrors.actualToDate = `Actual is cumulative and can't be lower than the ${formatTargetValue(previous.actualToDate, targetType)} approved for ${previous.reportingPeriod.name}.`;
        }
    }

    let completionDate: Date | null = null;
    if (input.completionDate) {
        completionDate = new Date(input.completionDate);
        if (Number.isNaN(completionDate.getTime())) fieldErrors.completionDate = 'Enter a valid date.';
        else if (completionDate > new Date()) fieldErrors.completionDate = "Completion date can't be in the future.";
        else if (completionDate < new Date(activity.startDate)) fieldErrors.completionDate = "Completion date can't be before the activity started.";
    }
    if (activity.targetAggregation === 'CUMULATIVE' && actual != null && target > 0 && actual >= target && !completionDate && !fieldErrors.completionDate) {
        fieldErrors.completionDate = 'The annual target is reached — enter the completion date.';
    }

    const row = computeReportRow(
        { weight: activity.weight, countsTowardWeight: activity.countsTowardWeight, targetType, annualTarget: activity.annualTarget, targetAggregation: activity.targetAggregation, targetDirection: activity.targetDirection, monthlyTargets: activity.monthlyTargets },
        { actualToDate: actual, completionDate },
        period.endDate
    );
    if (row.isBehindPlan) {
        if (!input.reasonForVariation?.trim()) fieldErrors.reasonForVariation = 'Required — the actual is below the plan for this period.';
        if (!input.wayForward?.trim()) fieldErrors.wayForward = 'Required — the actual is below the plan for this period.';
    }
    const tooLong = (v?: string) => (v ?? '').length > 5000;
    for (const key of ['accomplishedTasks', 'reasonForVariation', 'wayForward', 'escalationIssues'] as const) {
        if (tooLong(input[key])) fieldErrors[key] = 'Must be 5000 characters or less.';
    }

    if (Object.keys(fieldErrors).length > 0) {
        return fail(Object.values(fieldErrors)[0], fieldErrors);
    }

    await prisma.activityPeriodEntry.update({
        where: { id: entryId },
        data: {
            reportStatus: 'SUBMITTED',
            actualToDate: actual,
            completionDate,
            comment: input.accomplishedTasks?.trim() || null,
            reasonForVariation: input.reasonForVariation?.trim() || null,
            wayForward: input.wayForward?.trim() || null,
            escalationIssues: input.escalationIssues?.trim() || null,
            // Refresh the snapshot in case the breakdown changed since the request.
            planToDate: row.planToDate,
            declineReason: null,
            submittedById: user.id,
            submittedAt: new Date(),
        },
    });

    if (period.reportRequestSentById && period.reportRequestSentById !== user.id) {
        await prisma.notification.create({
            data: {
                type: 'REPORT_SUBMITTED',
                message: `${user.name} submitted the "${period.name}" report for "${activity.title}".`,
                date: new Date(),
                read: false,
                userId: period.reportRequestSentById,
                activityId: activity.id,
                reportingPeriodId: period.id,
            },
        });
    }

    revalidateReportPages();
    return { success: true };
}

export async function getPendingPeriodReports() {
    await requirePermission('activities:edit');
    const entries = await prisma.activityPeriodEntry.findMany({
        where: { reportStatus: 'SUBMITTED' },
        include: reportEntryInclude,
        orderBy: { submittedAt: 'asc' },
    });
    return JSON.parse(JSON.stringify(entries));
}

export async function approvePeriodReport(entryId: string): Promise<ReportActionResult> {
    const approver = await requirePermission('activities:edit');

    const entry = await prisma.activityPeriodEntry.findUnique({ where: { id: entryId }, include: reportEntryInclude });
    if (!entry) return fail('This report no longer exists.');
    if (entry.reportStatus !== 'SUBMITTED') return fail("This report isn't waiting for approval any more — it may already have been handled.");
    const { activity, reportingPeriod: period } = entry;

    const row = computeReportRow(
        { weight: activity.weight, countsTowardWeight: activity.countsTowardWeight, targetType: activity.targetType as TargetType | null, annualTarget: activity.annualTarget, targetAggregation: activity.targetAggregation, targetDirection: activity.targetDirection, monthlyTargets: activity.monthlyTargets },
        { actualToDate: entry.actualToDate, completionDate: entry.completionDate },
        period.endDate
    );

    // Only move the activity's headline numbers forward if this is its latest approved period.
    const laterApproved = await prisma.activityPeriodEntry.findFirst({
        where: { activityId: activity.id, reportStatus: 'APPROVED', reportingPeriod: { endDate: { gt: period.endDate } } },
    });
    const target = activity.annualTarget ?? 0;
    const overallProgress = target > 0 && entry.actualToDate != null ? Math.min(100, (entry.actualToDate / target) * 100) : activity.progress;
    const statusRules = await prisma.rule.findMany({ select: { status: true, min: true, max: true } });
    const newStatus = calculateActivityStatus({ ...activity, progress: overallProgress }, statusRules);

    await prisma.$transaction([
        prisma.activityPeriodEntry.update({
            where: { id: entryId },
            data: {
                reportStatus: 'APPROVED',
                declineReason: null,
                approvedById: approver.id,
                approvedAt: new Date(),
                // Keep the older progress fields in step for screens that still read them.
                plannedProgress: row.completionShare != null ? Math.min(100, row.completionShare * 100) : 0,
                actualProgress: overallProgress,
            },
        }),
        ...(laterApproved ? [] : [prisma.activity.update({
            where: { id: activity.id },
            data: {
                progress: overallProgress,
                status: newStatus,
                completionDate: entry.completionDate ?? activity.completionDate,
                ...(entry.reasonForVariation ? { delayExplanation: entry.reasonForVariation } : {}),
                ...(entry.wayForward ? { recommendedAction: entry.wayForward } : {}),
            },
        })]),
    ]);

    await prisma.notification.create({
        data: {
            type: 'REPORT_APPROVED',
            message: `Your "${period.name}" report for "${activity.title}" was approved.`,
            date: new Date(),
            read: false,
            userId: activity.responsibleId,
            activityId: activity.id,
            reportingPeriodId: period.id,
        },
    });

    revalidateReportPages();
    return { success: true };
}

export async function returnPeriodReport(entryId: string, reason: string): Promise<ReportActionResult> {
    await requirePermission('activities:edit');

    const trimmed = (reason ?? '').trim();
    if (!trimmed) return fail('Please give a reason so the owner knows what to change.');

    const entry = await prisma.activityPeriodEntry.findUnique({ where: { id: entryId }, include: { activity: true, reportingPeriod: true } });
    if (!entry) return fail('This report no longer exists.');
    if (entry.reportStatus !== 'SUBMITTED') return fail("This report isn't waiting for approval any more — it may already have been handled.");

    await prisma.activityPeriodEntry.update({
        where: { id: entryId },
        data: { reportStatus: 'RETURNED', declineReason: trimmed },
    });

    await prisma.notification.create({
        data: {
            type: 'REPORT_RETURNED',
            message: `Your "${entry.reportingPeriod.name}" report for "${entry.activity.title}" was returned: ${trimmed}`,
            date: new Date(),
            read: false,
            userId: entry.activity.responsibleId,
            activityId: entry.activityId,
            reportingPeriodId: entry.reportingPeriodId,
        },
    });

    revalidateReportPages();
    return { success: true };
}

/** Periods of a plan plus every report row in the chosen one, for the strategic plan page. */
export async function getPlanPerformance(strategicPlanId: string, periodId?: string) {
    await requireUser();
    const periods = await prisma.reportingPeriod.findMany({
        where: { strategicPlanId },
        orderBy: { startDate: 'asc' },
    });
    const withRequests = periods.filter(p => p.reportRequestSentAt);
    const selected = (periodId && periods.find(p => p.id === periodId)) || withRequests[withRequests.length - 1] || null;
    const entries = selected
        ? await prisma.activityPeriodEntry.findMany({
            where: { reportingPeriodId: selected.id, reportStatus: { not: 'NOT_REQUESTED' } },
        })
        : [];
    return JSON.parse(JSON.stringify({ periods, selected, entries }));
}
