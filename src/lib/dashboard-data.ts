import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/session';
import { monthKey } from '@/lib/monthly-breakdown';
import { computeDashboard, type DashboardMetrics, type MetricEntry, type MetricPeriod, type MetricPillar } from '@/lib/dashboard-metrics';
import { parseRatingThresholds } from '@/lib/rating-bands';

export interface DashboardPlanOption { id: string; name: string; version: string; status: string }
export interface DashboardPeriodOption extends MetricPeriod { reportRequested: boolean }

/** One reporting period's headline numbers, for the trend chart and period-over-period deltas. */
export interface TrendPoint {
  periodId: string;
  name: string;
  endDate: string;
  achieved: number | null;
  achievedWithDelay: number | null;
  yearProgress: number | null;
  weightedPlan: number;
  weightedActual: number;
  approved: number;
  planned: number;
  initiativesCompleted: number;
}

interface Context { userName: string; today: string }

export type DashboardData =
  | ({ state: 'no-plan'; plans: DashboardPlanOption[] } & Context)
  | ({ state: 'no-period'; plans: DashboardPlanOption[]; plan: DashboardPlanOption; periods: DashboardPeriodOption[] } & Context)
  | ({
      state: 'ready';
      plans: DashboardPlanOption[];
      plan: DashboardPlanOption;
      periods: DashboardPeriodOption[];
      period: DashboardPeriodOption;
      /** The selected period hasn't ended yet: numbers show what has been approved so far. */
      periodOpen: boolean;
      metrics: DashboardMetrics;
      /** The period before the selected one, for "change since last period". */
      previousMetrics: DashboardMetrics | null;
      /** Every period up to and including the selected one, oldest first. */
      trend: TrendPoint[];
    } & Context);

/**
 * Loads one plan and one reporting period and computes the dashboard, plus the
 * same headline numbers for every earlier period (the trend). Defaults: the
 * published plan (else the newest), and the latest period whose report request
 * has been sent, else the latest period that has ended, else the one in progress).
 * Only the fields the calculation needs are selected — no user records leave the server.
 */
export async function loadDashboard(planId?: string, periodId?: string): Promise<DashboardData> {
  const user = await requireUser();
  const context: Context = { userName: user.name, today: new Date().toISOString() };

  const plans: DashboardPlanOption[] = await prisma.strategicPlan.findMany({
    select: { id: true, name: true, version: true, status: true },
    orderBy: { updatedAt: 'desc' },
  });
  const plan = plans.find(p => p.id === planId) ?? plans.find(p => p.status === 'PUBLISHED') ?? plans[0];
  if (!plan) return { state: 'no-plan', plans, ...context };

  const periodRows = await prisma.reportingPeriod.findMany({
    where: { strategicPlanId: plan.id },
    select: { id: true, name: true, startDate: true, endDate: true, reportRequestSentAt: true },
    orderBy: { endDate: 'asc' },
  });
  const periods: DashboardPeriodOption[] = periodRows.map(p => ({
    id: p.id,
    name: p.name,
    startDate: p.startDate.toISOString(),
    endDate: p.endDate.toISOString(),
    reportRequested: p.reportRequestSentAt != null,
  }));

  const now = Date.now();
  const period =
    periods.find(p => p.id === periodId) ??
    [...periods].reverse().find(p => p.reportRequested) ??
    [...periods].reverse().find(p => new Date(p.endDate).getTime() <= now) ??
    // Only periods still in progress: show the one under way (approved reports so far).
    [...periods].reverse().find(p => new Date(p.startDate).getTime() <= now) ??
    periods[periods.length - 1] ??
    null;
  if (!period) return { state: 'no-period', plans, plan, periods, ...context };

  // The selected period and every period before it make up the trend.
  const history = periods.filter(p => new Date(p.endDate).getTime() <= new Date(period.endDate).getTime());

  const [pillarRows, entryRows, config] = await Promise.all([
    prisma.pillar.findMany({
      where: { strategicPlanId: plan.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        objectives: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            statement: true,
            initiatives: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                title: true,
                activities: {
                  orderBy: { createdAt: 'asc' },
                  select: {
                    id: true,
                    title: true,
                    weight: true,
                    countsTowardWeight: true,
                    leadOwner: true,
                    department: true,
                    startDate: true,
                    endDate: true,
                    planSubmissionStatus: true,
                    targetType: true,
                    annualTarget: true,
                    targetAggregation: true,
                    targetDirection: true,
                    monthlyTargets: { select: { month: true, value: true }, orderBy: { month: 'asc' } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.activityPeriodEntry.findMany({
      where: { reportingPeriodId: { in: history.map(p => p.id) } },
      select: {
        reportingPeriodId: true, activityId: true, reportStatus: true, actualToDate: true, completionDate: true,
        comment: true, reasonForVariation: true, wayForward: true, escalationIssues: true,
      },
    }),
    prisma.appConfig.findUnique({ where: { id: 'singleton' }, select: { ratingBands: true } }),
  ]);

  const pillars: MetricPillar[] = pillarRows.map(p => ({
    id: p.id,
    title: p.title,
    objectives: p.objectives.map(o => ({
      id: o.id,
      statement: o.statement,
      initiatives: o.initiatives.map(i => ({
        id: i.id,
        title: i.title,
        activities: i.activities.map(a => {
          const breakdownApproved = a.planSubmissionStatus === 'APPROVED';
          return {
            id: a.id,
            title: a.title,
            weight: a.weight,
            countsTowardWeight: a.countsTowardWeight,
            leadOwner: a.leadOwner,
            department: a.department,
            startDate: a.startDate.toISOString(),
            endDate: a.endDate.toISOString(),
            breakdownApproved,
            targetType: a.targetType,
            annualTarget: a.annualTarget,
            targetAggregation: a.targetAggregation,
            targetDirection: a.targetDirection,
            monthlyTargets: breakdownApproved ? a.monthlyTargets.map(t => ({ month: monthKey(t.month), value: t.value })) : [],
          };
        }),
      })),
    })),
  }));

  const ratingThresholds = parseRatingThresholds(config?.ratingBands);

  const entriesByPeriod = new Map<string, MetricEntry[]>();
  for (const e of entryRows) {
    const list = entriesByPeriod.get(e.reportingPeriodId) ?? [];
    list.push({
      activityId: e.activityId,
      reportStatus: e.reportStatus,
      actualToDate: e.actualToDate,
      completionDate: e.completionDate ? e.completionDate.toISOString() : null,
      comment: e.comment,
      reasonForVariation: e.reasonForVariation,
      wayForward: e.wayForward,
      escalationIssues: e.escalationIssues,
    });
    entriesByPeriod.set(e.reportingPeriodId, list);
  }

  let metrics: DashboardMetrics | null = null;
  let previousMetrics: DashboardMetrics | null = null;
  const previousPeriodId = history.length > 1 ? history[history.length - 2].id : null;
  const trend: TrendPoint[] = history.map(p => {
    const m = computeDashboard(pillars, entriesByPeriod.get(p.id) ?? [], p, ratingThresholds);
    if (p.id === period.id) metrics = m;
    if (p.id === previousPeriodId) previousMetrics = m;
    const { rollup, coverage, yearProgress } = m.overall;
    return {
      periodId: p.id,
      name: p.name,
      endDate: p.endDate,
      achieved: rollup.weightedPlan > 0 ? rollup.achievedResult : null,
      achievedWithDelay: rollup.weightedPlan > 0 ? rollup.achievedWithDelay : null,
      yearProgress,
      weightedPlan: rollup.weightedPlan,
      weightedActual: rollup.weightedActual,
      approved: coverage.approved,
      planned: coverage.planned,
      initiativesCompleted: m.initiativesCompleted,
    };
  });

  return {
    state: 'ready',
    plans,
    plan,
    periods,
    period,
    periodOpen: new Date(period.endDate).getTime() > now,
    metrics: metrics ?? computeDashboard(pillars, entriesByPeriod.get(period.id) ?? [], period, ratingThresholds),
    trend,
    previousMetrics,
    ...context,
  };
}
