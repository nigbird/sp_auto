import { prisma } from '@/lib/prisma';

/**
 * Ensures this activity has an ActivityPeriodEntry for every ReportingPeriod
 * that overlaps its own [startDate, endDate] range — the periods its actuals
 * are reported against. Safe to call repeatedly: only creates missing rows.
 * Server-only (not a server action), so browsers can't call it directly.
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
