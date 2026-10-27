/**
 * Loads what the report summary is generated from and exported with: the
 * period, its plan tree, the period's reports, the saved summary, and the
 * dashboard's figures its tables use. Server-only (uses Prisma); permission
 * checks stay with the callers.
 */

import { prisma } from './prisma';
import { loadPlanDashboard } from './dashboard-data';
import { parseCorrections, summaryTree, type SummaryCorrection } from './report-summary';
import { buildTables, tableCatalog, type SummaryTable, type TableContext, type TableOption } from './summary-tables';

const PLAN_TREE = {
  pillars: {
    orderBy: { createdAt: 'asc' },
    include: {
      objectives: {
        orderBy: { createdAt: 'asc' },
        include: {
          initiatives: {
            orderBy: { createdAt: 'asc' },
            include: {
              activities: {
                orderBy: { createdAt: 'asc' },
                include: { responsible: { select: { name: true } }, monthlyTargets: { orderBy: { month: 'asc' } } },
              },
            },
          },
        },
      },
    },
  },
} as const;

export async function loadSummaryCorrections(): Promise<SummaryCorrection[]> {
  const config = await prisma.appConfig.findUnique({ where: { id: 'singleton' }, select: { summaryCorrections: true } });
  return parseCorrections(config?.summaryCorrections);
}

/** The period with its plan, the period's reports, and the saved summary (sections in order). Null if the period doesn't exist. */
export async function loadSummarySource(periodId: string) {
  const period = await prisma.reportingPeriod.findUnique({
    where: { id: periodId },
    include: {
      strategicPlan: { include: PLAN_TREE },
      summary: { include: { sections: { orderBy: { position: 'asc' } } } },
    },
  });
  if (!period) return null;
  const entries = await prisma.activityPeriodEntry.findMany({ where: { reportingPeriodId: period.id, reportStatus: { not: 'NOT_REQUESTED' } } });
  const plan = period.strategicPlan;
  return { period, plan, entries, summary: period.summary };
}

export type SummarySource = NonNullable<Awaited<ReturnType<typeof loadSummarySource>>>;

/** What the summary's tables are built from; the dashboard figures are computed for the whole plan. */
export async function loadTableContext(source: SummarySource, corrections?: SummaryCorrection[]): Promise<TableContext> {
  const dashboard = await loadPlanDashboard(source.plan.id, source.period.id);
  const ready = dashboard.state === 'ready' && dashboard.plan.id === source.plan.id && dashboard.period.id === source.period.id;
  return {
    tree: summaryTree(source.plan, source.entries, source.period),
    periodEndDate: source.period.endDate,
    metrics: ready ? dashboard.metrics : null,
    trend: ready ? dashboard.trend : [],
    corrections: corrections ?? await loadSummaryCorrections(),
  };
}

/** The tables used by the visible sections, and every table that could be added with how it can be filtered. */
export async function loadSummaryTables(source: SummarySource): Promise<{ tables: Record<string, SummaryTable>; catalog: TableOption[] }> {
  const ctx = await loadTableContext(source);
  const keys = (source.summary?.sections ?? []).filter(s => !s.hidden).flatMap(s => s.tables);
  return { tables: buildTables(ctx, keys), catalog: tableCatalog(ctx) };
}
