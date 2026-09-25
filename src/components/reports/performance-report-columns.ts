/**
 * Column definitions for the performance report, shared by the server
 * component (which computes each cell) and the client grid (which lays out
 * and switches between column groups).
 */

import { format } from "date-fns";
import { formatTargetValue, type TargetType } from "@/lib/monthly-breakdown";
import { formatRatio, formatWeight, type ReportRollup, type ReportRow } from "@/lib/report-calculations";

export interface ReportEntryValues {
  actualToDate: number | null;
  completionDate: string | null;
  comment: string | null;
  reasonForVariation: string | null;
  wayForward: string | null;
  escalationIssues: string | null;
}

interface Filled { entry: ReportEntryValues; row: ReportRow; t: TargetType | null }

export type ColumnGroup = 'progress' | 'narrative' | 'weighted';
export type ColumnKind = 'num' | 'text' | 'date' | 'status';

export interface ReportColumn {
  label: string;
  group: ColumnGroup;
  /** Filled in by the activity owner (the Excel's blue columns). */
  owner?: boolean;
  kind: ColumnKind;
  cell: (f: Filled) => string;
  /** Value on the initiative roll-up line; columns without one stay blank there. */
  rollup?: (r: ReportRollup) => string;
}

export const REPORT_COLUMNS: ReportColumn[] = [
  { label: 'Plan up to the period', group: 'progress', owner: true, kind: 'num', cell: f => formatTargetValue(f.row.planToDate, f.t) },
  { label: 'Actual up to the period', group: 'progress', owner: true, kind: 'num', cell: f => f.entry.actualToDate != null ? formatTargetValue(f.entry.actualToDate, f.t) : '—' },
  { label: "%age Achiev't", group: 'progress', kind: 'num', cell: f => formatRatio(f.row.achievement) },
  { label: 'Completion Date', group: 'progress', kind: 'date', cell: f => f.entry.completionDate ? format(new Date(f.entry.completionDate), 'dd-MMM-yy') : '' },
  { label: 'Date Delayed', group: 'progress', kind: 'num', cell: f => f.row.daysDelayed != null ? String(f.row.daysDelayed) : '' },
  { label: "%age Achiev't with delay", group: 'progress', kind: 'num', cell: f => formatRatio(f.row.achievementWithDelay) },
  { label: 'Accomplished Tasks & Key Achievements', group: 'narrative', owner: true, kind: 'text', cell: f => f.entry.comment ?? '' },
  { label: 'Reasons for Variation', group: 'narrative', owner: true, kind: 'text', cell: f => f.entry.reasonForVariation ?? '' },
  { label: 'The Way Forward', group: 'narrative', owner: true, kind: 'text', cell: f => f.entry.wayForward ?? '' },
  { label: 'Issues that need Escalation', group: 'narrative', owner: true, kind: 'text', cell: f => f.entry.escalationIssues ?? '' },
  { label: 'Weighted Plan', group: 'weighted', kind: 'num', cell: f => formatWeight(f.row.weightedPlan), rollup: r => formatWeight(r.weightedPlan) },
  { label: 'Weighted Actual', group: 'weighted', kind: 'num', cell: f => formatWeight(f.row.weightedActual), rollup: r => formatWeight(r.weightedActual) },
  { label: 'Weighted Actual with Delay', group: 'weighted', kind: 'num', cell: f => formatWeight(f.row.weightedActualWithDelay), rollup: r => formatWeight(r.weightedActualWithDelay) },
  { label: 'Weighted Actual (No Dup)', group: 'weighted', kind: 'num', cell: f => formatWeight(f.row.weightedActualNoDup), rollup: r => formatWeight(r.weightedActualNoDup) },
  { label: 'Achieved Result', group: 'weighted', kind: 'num', cell: f => formatRatio(f.row.achievedResult), rollup: r => formatRatio(r.achievedResult) },
  { label: "Achiev't with Delay", group: 'weighted', kind: 'num', cell: f => formatRatio(f.row.achievedWithDelay), rollup: r => formatRatio(r.achievedWithDelay) },
  { label: 'Activity Status', group: 'weighted', kind: 'status', cell: f => f.row.status, rollup: r => r.weightedPlan > 0 ? r.status : '—' },
];

export const REPORT_VIEWS: { id: ColumnGroup | 'all'; label: string; hint: string }[] = [
  { id: 'progress', label: 'Progress', hint: 'Plan vs. actual and delay' },
  { id: 'narrative', label: 'Narrative', hint: 'Achievements, variation, way forward, escalation' },
  { id: 'weighted', label: 'Weighted results', hint: 'Weighted values, achieved result and status' },
  { id: 'all', label: 'All columns', hint: 'The full Excel layout; scroll sideways' },
];

export function statusClass(status: string) {
  if (status.startsWith('Completed')) return 'text-green-600';
  if (status === 'In Good Progress') return 'text-sky-600';
  if (status === 'Not In Good Progress') return 'text-amber-600';
  return 'text-muted-foreground';
}
