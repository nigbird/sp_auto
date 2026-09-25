import Link from "next/link";
import { format } from "date-fns";
import type { Pillar } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { TargetType } from "@/lib/monthly-breakdown";
import { computeReportRow, formatRatio, formatWeight, rollUp, type ReportRow } from "@/lib/report-calculations";
import { REPORT_COLUMNS, statusClass } from "./performance-report-columns";
import { PerformanceReportGrid, type GridActivity, type GridPillar } from "./performance-report-grid";

type Activity = Pillar['objectives'][number]['initiatives'][number]['activities'][number];

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

const STATUS_TEXT: Record<string, string> = {
  REQUESTED: 'Awaiting report',
  RETURNED: 'Returned to owner',
  SUBMITTED: 'Pending approval',
};

/**
 * The plan's report for one reporting period, laid out like the Excel's
 * report columns. Only approved reports fill in values and count toward the
 * totals; other rows show where their report stands.
 *
 * Cells are computed here on the server and handed to the client grid as
 * plain strings, so raw plan records (e.g. user rows) never reach the browser.
 */
export function PerformanceReportTable({ planId, pillars, periods, selected, entries }: { planId: string; pillars: Pillar[]; periods: PerformancePeriod[]; selected: PerformancePeriod | null; entries: PerformanceEntry[] }) {
  const requested = periods.filter(p => p.reportRequestSentAt);

  if (!selected) {
    return <p className="text-sm text-muted-foreground">No reports have been requested yet. Send a report request from Reporting Periods; results appear here as reports are approved.</p>;
  }

  const entryByActivity = new Map(entries.map(e => [e.activityId, e]));
  const approvedRows: ReportRow[] = [];
  let reportCount = 0;

  const toRow = (activity: Activity): { grid: GridActivity; row: ReportRow | null } | null => {
    const entry = entryByActivity.get(activity.id);
    if (!entry) return null;
    reportCount++;
    const row = entry.reportStatus === 'APPROVED'
      ? computeReportRow(
          { weight: activity.weight, countsTowardWeight: activity.countsTowardWeight, targetType: activity.targetType as TargetType | null, annualTarget: activity.annualTarget, targetAggregation: activity.targetAggregation, targetDirection: activity.targetDirection, monthlyTargets: (activity.monthlyTargets ?? []) as { month: string; value: number }[] },
          { actualToDate: entry.actualToDate, completionDate: entry.completionDate },
          selected.endDate
        )
      : null;
    if (row) approvedRows.push(row);
    const t = activity.targetType as TargetType | null;
    return {
      row,
      grid: {
        id: activity.id,
        title: activity.title,
        owner: (activity.responsible as { name?: string } | null)?.name ?? '',
        cells: row ? REPORT_COLUMNS.map(c => c.cell({ entry, row, t })) : null,
        statusText: STATUS_TEXT[entry.reportStatus] ?? 'Not requested',
      },
    };
  };

  const grid: GridPillar[] = pillars.map(pillar => ({
    id: pillar.id,
    title: pillar.title,
    objectives: pillar.objectives.map(objective => ({
      id: objective.id,
      statement: objective.statement,
      initiatives: objective.initiatives.map(initiative => {
        const rows = initiative.activities.map(toRow).filter((r): r is NonNullable<typeof r> => r !== null);
        const rollup = rollUp(rows.map(r => r.row).filter((r): r is ReportRow => r !== null));
        return {
          id: initiative.id,
          title: initiative.title,
          rollup: REPORT_COLUMNS.map(c => c.rollup?.(rollup) ?? ''),
          rows: rows.map(r => r.grid),
        };
      }).filter(i => i.rows.length > 0),
    })).filter(o => o.initiatives.length > 0),
  })).filter(p => p.objectives.length > 0);

  const total = rollUp(approvedRows);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Reporting period:</span>
        {requested.map(p => (
          <Link key={p.id} href={`/reports?plan=${planId}&period=${p.id}`} scroll={false}
            className={cn("rounded-md border px-2.5 py-1 text-sm", p.id === selected.id ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted")}>
            {p.name}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Reports approved" value={`${approvedRows.length} of ${reportCount}`} />
        <Stat label="Weighted plan" value={formatWeight(total.weightedPlan)} />
        <Stat label="Weighted actual" value={formatWeight(total.weightedActual)} />
        <Stat label="Weighted actual with delay" value={formatWeight(total.weightedActualWithDelay)} />
        <Stat label="Achieved result" value={formatRatio(total.achievedResult)} sub={total.status} />
      </div>

      <PerformanceReportGrid pillars={grid} />

      <p className="text-xs text-muted-foreground">
        Blue columns are filled in by activity owners; the rest are calculated. Totals and initiative results count approved reports only. Delay penalty: −10% after 30 days, −20% after 60, −50% after 90, measured from the end of the last planned month.
        {' '}Period: {format(new Date(selected.startDate), 'PP')} – {format(new Date(selected.endDate), 'PP')}.
      </p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
      {sub && <p className={cn("text-xs", statusClass(sub))}>{sub}</p>}
    </div>
  );
}
