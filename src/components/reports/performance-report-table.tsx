import { format } from "date-fns";
import type { Pillar } from "@/lib/types";
import { buildPerformanceTree, REPORT_STATE_LABEL } from "@/lib/performance-report";
import { REPORT_COLUMNS } from "./performance-report-columns";
import { PerformanceReportGrid, type GridActivity, type GridPillar } from "./performance-report-grid";
import { PeriodSelect } from "./period-select";
import { EmptyState } from "@/components/empty-state";

export interface PerformancePeriod { id: string; name: string; startDate: string; endDate: string; reportRequestSentAt: string | null }
export interface PerformanceEntry {
  id: string;
  activityId: string;
  reportStatus: 'REQUESTED' | 'SUBMITTED' | 'APPROVED' | 'RETURNED' | 'NOT_REQUESTED';
  actualToDate: number | null;
  completionDate: string | null;
  comment: string | null;
  reasonForVariation: string | null;
  wayForward: string | null;
  escalationIssues: string | null;
}

/**
 * The plan's report for one reporting period, laid out like the Excel's
 * report columns. Only approved reports fill in values and count toward the
 * totals; other rows show where their report stands.
 *
 * Cells are computed here on the server and handed to the client grid as
 * plain strings, so raw plan records (e.g. user rows) never reach the browser.
 */
export function PerformanceReportTable({ planId, pillars, periods, selected, entries, canExport = false }: { planId: string; pillars: Pillar[]; periods: PerformancePeriod[]; selected: PerformancePeriod | null; entries: PerformanceEntry[]; canExport?: boolean }) {
  if (!selected) {
    return <EmptyState art="chart" title="No reporting periods yet" description="Create a reporting period first; performance results appear here as reports are approved." className="rounded-xl border border-dashed border-border/70 bg-card/60" />;
  }

  if (entries.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Reporting period:</span>
          <PeriodSelect periods={periods} value={selected.id} planId={planId} />
        </div>
        <EmptyState
          art="chart"
          title="No results yet"
          description={<>No reports have been requested for {selected.name} yet. Send a report request from Reporting Periods; results appear here as reports are approved.</>}
          className="rounded-xl border border-dashed border-border/70 bg-card/60"
        />
      </div>
    );
  }

  const tree = buildPerformanceTree(pillars, entries, selected.endDate);
  const grid: GridPillar[] = tree.map(p => ({
    ...p,
    objectives: p.objectives.map(o => ({
      ...o,
      initiatives: o.initiatives.map(i => ({
        ...i,
        activities: i.activities.map(({ entry, row, targetType: t, ...a }): GridActivity => ({
          ...a,
          cells: row ? REPORT_COLUMNS.map(c => c.cell({ entry, row, t })) : null,
          weighted: row ? { weightedPlan: row.weightedPlan, weightedActual: row.weightedActual, weightedActualWithDelay: row.weightedActualWithDelay, weightedActualNoDup: row.weightedActualNoDup } : null,
          statusText: REPORT_STATE_LABEL[a.state],
        })),
      })),
    })),
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Reporting period:</span>
        <PeriodSelect periods={periods} value={selected.id} planId={planId} />
      </div>

      <PerformanceReportGrid pillars={grid} exportBase={canExport ? `/api/export/performance/${planId}?period=${selected.id}` : null} />

      <p className="text-xs text-muted-foreground">
        Totals count approved reports only.
        {' '}Period: {format(new Date(selected.startDate), 'PP')} – {format(new Date(selected.endDate), 'PP')}.
      </p>
    </div>
  );
}
